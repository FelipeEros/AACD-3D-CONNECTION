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
  await loadSolicitacao(req);
  await callRpc(req.db, RPC.atualizarStatusSolicitacao, { id: req.params.id, status: req.body.status });
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
  await loadSolicitacao(req);
  const itens = await listItens(req.db, req.params.id);
  const ids = new Set(itens.map((i) => i.id));
  const desconhecidos = req.body.consumo.filter((c) => !ids.has(c.item_id)).map((c) => c.item_id);
  if (desconhecidos.length) throw badRequest('Itens não pertencem a esta solicitação', { item_ids: desconhecidos });
  const faltando = itens.filter((i) => !req.body.consumo.some((c) => c.item_id === i.id)).map((i) => i.id);
  if (faltando.length) throw badRequest('Informe o consumo de todos os itens', { item_ids: faltando });

  await callRpc(req.db, RPC.concluirProducao, { id: req.params.id, consumo: req.body.consumo });
  res.json(await getRow(req.db, TABLES.solicitacoes, req.params.id));
}));

export default router;
