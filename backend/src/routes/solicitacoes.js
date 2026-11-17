import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, idParams, pagination, uuid } from '../lib/validate.js';
import { notFound, badRequest } from '../lib/errors.js';
import { requireRole, scopeInstituicao } from '../middlewares/auth.js';
import { listRows, getRow, insertRow } from '../lib/query.js';
import { TABLES, COLUMNS, RPC, STATUS_SOLICITACAO, callRpc } from '../config/schema.js';

const router = Router();

const statusList = z.string().transform((v) => v.split(',').map((s) => s.trim()))
  .pipe(z.array(z.enum(STATUS_SOLICITACAO)));

const listQuery = pagination.extend({
  status: statusList.optional(),
  instituicao_id: uuid.optional(),
  impressora_id: uuid.optional(),
});

// GET /api/solicitacoes?status=concluida  -> histórico da tela Utilizações
router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { status, impressora_id: impressoraId, limit, offset } = req.validQuery;
  res.json(await listRows(req.db, TABLES.solicitacoes, {
    filters: {
      [COLUMNS.status]: status,
      [COLUMNS.impressoraId]: impressoraId,
      [COLUMNS.instituicaoId]: scopeInstituicao(req, req.validQuery.instituicao_id),
    },
    limit, offset,
  }));
}));

async function loadSolicitacao(req) {
  const row = await getRow(req.db, TABLES.solicitacoes, req.params.id);
  if (!row) throw notFound('Solicitação não encontrada');
  scopeInstituicao(req, row[COLUMNS.instituicaoId]);
  return row;
}

async function listItens(db, solicitacaoId) {
  const { data, error } = await db.from(TABLES.itensSolicitacao)
    .select(`*, material:${TABLES.materiais}(*)`)
    .eq(COLUMNS.solicitacaoId, solicitacaoId);
  if (error) throw error;
  return data ?? [];
}

function rpcNaoEncontrada(error) {
  return error?.code === 'PGRST202'
    || /Could not find the function/i.test(error?.message ?? '');
}

const TRANSICOES_STATUS = Object.freeze({
  pendente: new Set(['aceita', 'recusada']),
  aceita: new Set(['em_producao']),
});

async function atualizarStatusSemRpc(req, solicitacao, status) {
  if (!TRANSICOES_STATUS[solicitacao.status]?.has(status)) {
    throw badRequest(`Transição inválida: ${solicitacao.status} -> ${status}`);
  }
  const admin = req.app.locals.supabase.admin();
  const { error } = await admin.from(TABLES.solicitacoes)
    .update({ [COLUMNS.status]: status })
    .eq('id', solicitacao.id);
  if (error) throw error;
}

async function concluirSemRpc(req, solicitacao, itens, consumo) {
  if (solicitacao.status !== 'em_producao') {
    throw badRequest(`Transição inválida: ${solicitacao.status} -> concluida`);
  }
  const itensPorId = new Map(itens.map((item) => [item.id ?? item.item_id, item]));
  for (const registro of consumo) {
    if (registro.quantidade_consumida === 0) continue;
    const item = itensPorId.get(registro.item_id);
    await callRpc(req.db, RPC.registrarMovimentacaoEstoque, {
      materialId: item.material_id,
      tipo: 'ajuste',
      quantidade: -registro.quantidade_consumida,
      observacao: `Consumo da solicitação ${solicitacao.id}`,
    });
  }
  const admin = req.app.locals.supabase.admin();
  const { error } = await admin.from(TABLES.solicitacoes)
    .update({ [COLUMNS.status]: 'concluida' })
    .eq('id', solicitacao.id);
  if (error) throw error;
}

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const solicitacao = await loadSolicitacao(req);
  res.json({ ...solicitacao, itens: await listItens(req.db, solicitacao.id) });
}));

// ---- Criação (AACD) -----------------------------------------------------

const createBody = z.object({
  instituicao_id: uuid,
  impressora_id: uuid,
  prazo: z.string().date('Use o formato AAAA-MM-DD').optional(),
  observacoes: z.string().trim().max(2000).optional(),
  itens: z.array(z.object({
    material_id: uuid,
    quantidade: z.number().positive(),
    observacoes: z.string().trim().max(1000).optional(),
  }).strict()).min(1, 'Informe ao menos um item').max(50),
}).strict();

async function assertImpressoraCompativel(db, { instituicao_id: instituicaoId, impressora_id: impressoraId, itens }) {
  const impressora = await getRow(db, TABLES.impressoras, impressoraId);
  if (!impressora) throw badRequest('Impressora não encontrada');
  if (impressora[COLUMNS.instituicaoId] !== instituicaoId) throw badRequest('A impressora não pertence à instituição escolhida');
  if (impressora[COLUMNS.status] === 'indisponivel') throw badRequest('Impressora indisponível');

  const { data, error } = await db.from(TABLES.impressoraMateriais)
    .select(COLUMNS.materialId).eq(COLUMNS.impressoraId, impressoraId);
  if (error) throw error;
  const compativeis = new Set((data ?? []).map((r) => r[COLUMNS.materialId]));
  const invalidos = itens.map((i) => i.material_id).filter((id) => !compativeis.has(id));
  if (invalidos.length) throw badRequest('Materiais incompatíveis com a impressora', { material_ids: invalidos });
}

router.post('/', requireRole('aacd'), validate({ body: createBody }), asyncHandler(async (req, res) => {
  const { itens, ...dados } = req.body;
  await assertImpressoraCompativel(req.db, req.body);

  // Status inicial "pendente" é definido pelo banco.
  const solicitacao = await insertRow(req.db, TABLES.solicitacoes, dados);
  const criados = [];
  try {
    for (const item of itens) {
      criados.push(await insertRow(req.db, TABLES.itensSolicitacao, { ...item, [COLUMNS.solicitacaoId]: solicitacao.id }));
    }
  } catch (err) {
    // Sem transação no PostgREST: cancela para não deixar pedido incompleto disponível para aceite.
    await callRpc(req.db, RPC.cancelarSolicitacao, { id: solicitacao.id }).catch(() => {});
    throw err;
  }
  res.status(201).json({ ...solicitacao, itens: criados });
}));

// ---- Fluxo de status ----------------------------------------------------
// pendente -> aceita -> em_producao -> concluida
// pendente -> recusada | cancelada ; aceita -> cancelada
// As transições são validadas pelo banco; aqui só filtramos quem pode pedir.

router.post('/:id/status', requireRole('instituicao'), validate({
  params: idParams,
  body: z.object({ status: z.enum(['aceita', 'recusada', 'em_producao']) }),
}), asyncHandler(async (req, res) => {
  const solicitacao = await loadSolicitacao(req);
  try {
    await callRpc(req.db, RPC.atualizarStatusSolicitacao, { id: req.params.id, status: req.body.status });
  } catch (error) {
    if (!rpcNaoEncontrada(error)) throw error;
    await atualizarStatusSemRpc(req, solicitacao, req.body.status);
  }
  res.json(await getRow(req.db, TABLES.solicitacoes, req.params.id));
}));

router.post('/:id/cancelar', requireRole('aacd'), validate({ params: idParams }), asyncHandler(async (req, res) => {
  await callRpc(req.db, RPC.cancelarSolicitacao, { id: req.params.id });
  res.json(await getRow(req.db, TABLES.solicitacoes, req.params.id));
}));

// A baixa de estoque é feita pelo banco nesta RPC: não descontar de novo aqui.
router.post('/:id/concluir', requireRole('instituicao'), validate({
  params: idParams,
  body: z.object({
    consumo: z.array(z.object({ item_id: uuid, quantidade_consumida: z.number().min(0) })).min(1),
  }),
}), asyncHandler(async (req, res) => {
  const solicitacao = await loadSolicitacao(req);
  const itens = await listItens(req.db, req.params.id);
  const ids = new Set(itens.map((i) => i.id ?? i.item_id));
  const desconhecidos = req.body.consumo.filter((c) => !ids.has(c.item_id)).map((c) => c.item_id);
  if (desconhecidos.length) throw badRequest('Itens não pertencem a esta solicitação', { item_ids: desconhecidos });
  const faltando = itens
    .map((i) => i.id ?? i.item_id)
    .filter((itemId) => !req.body.consumo.some((c) => c.item_id === itemId));
  if (faltando.length) throw badRequest('Informe o consumo de todos os itens', { item_ids: faltando });

  try {
    await callRpc(req.db, RPC.concluirProducao, { id: req.params.id, consumo: req.body.consumo });
  } catch (error) {
    if (!rpcNaoEncontrada(error)) throw error;
    await concluirSemRpc(req, solicitacao, itens, req.body.consumo);
  }
  res.json(await getRow(req.db, TABLES.solicitacoes, req.params.id));
}));

export default router;
