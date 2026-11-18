import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, idParams, pagination, uuid } from '../lib/validate.js';
import { notFound, badRequest } from '../lib/errors.js';
import { requireRole, scopeInstituicao } from '../middlewares/auth.js';
import { listRows, getRow, insertRow, updateRow, compact } from '../lib/query.js';
import { TABLES, VIEWS, COLUMNS, RPC, callRpc } from '../config/schema.js';

const router = Router();
const text = (max = 200) => z.string().trim().min(1).max(max);

const materialFields = {
  nome: text(),
  tipo: z.enum(['Filamento', 'Resina', 'Pó', 'Outro', 'filamento', 'resina', 'pó', 'outro'])
    .transform((value) => value.toLowerCase()),
  marca: text(),
  lote: text(100),
  cor: text(60),
  unidade: z.literal('g'),
  compatibilidade: text(200).optional(),
};

const createBody = z.object({
  ...materialFields,
  instituicao_id: uuid.optional(),
  quantidade_inicial: z.number().positive().optional(),
}).strict();

const updateBody = z.object(Object.fromEntries(
  Object.entries(materialFields).map(([k, v]) => [k, v.optional()]),
)).extend({ quantidade_estoque: z.number().min(0).optional() }).strict();

const listQuery = pagination.extend({
  tipo: z.string().optional(),
  instituicao_id: uuid.optional(),
  busca: z.string().optional(),
});

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { tipo, busca, limit, offset } = req.validQuery;
  const page = await listRows(req.db, TABLES.materiais, {
    filters: { tipo, [COLUMNS.instituicaoId]: scopeInstituicao(req, req.validQuery.instituicao_id) },
    search: busca, searchColumns: ['nome'],
    orderBy: COLUMNS.nome, ascending: true, limit, offset,
  });

  if (!page.data.length) return res.json(page);

  const materialIds = page.data.map((material) => material.id);
  const [saldosResult, alertasResult] = await Promise.all([
    req.db.from(VIEWS.saldoEstoque).select('*').in(COLUMNS.materialId, materialIds),
    req.db.from(VIEWS.alertasEstoque).select('*').in(COLUMNS.materialId, materialIds),
  ]);
  if (saldosResult.error) throw saldosResult.error;
  if (alertasResult.error) throw alertasResult.error;

  const saldos = new Map((saldosResult.data || []).map((row) => [row[COLUMNS.materialId] || row.id, row]));
  const alertas = new Map((alertasResult.data || []).map((row) => [row[COLUMNS.materialId] || row.id, row]));

  res.json({
    ...page,
    data: page.data.map((material) => {
      const saldo = saldos.get(material.id);
      const alerta = alertas.get(material.id);
      return {
        ...material,
        saldo_atual: Number(saldo?.saldo_atual ?? saldo?.saldo ?? saldo?.quantidade ?? 0),
        estoque_minimo: Number(alerta?.estoque_minimo ?? material.estoque_minimo ?? 0),
        situacao_estoque: alerta?.situacao ?? null,
      };
    }),
  });
}));

async function loadMaterial(req) {
  const row = await getRow(req.db, TABLES.materiais, req.params.id);
  if (!row) throw notFound('Material não encontrado');
  scopeInstituicao(req, row[COLUMNS.instituicaoId]);
  return row;
}

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  res.json(await loadMaterial(req));
}));

router.post('/', validate({ body: createBody }), asyncHandler(async (req, res) => {
  const {
    quantidade_inicial: quantidade,
    instituicao_id: requested,
    marca,
    lote,
    compatibilidade,
    ...fields
  } = req.body;
  const instituicaoId = scopeInstituicao(req, requested);
  if (!instituicaoId) throw badRequest('Informe instituicao_id');

  const caracteristicas = Object.fromEntries(
    Object.entries({ marca, lote, compatibilidade }).filter(([, value]) => value !== undefined),
  );
  const material = await insertRow(req.db, TABLES.materiais, {
    ...fields, caracteristicas, [COLUMNS.instituicaoId]: instituicaoId,
  });
  // O saldo nunca é gravado direto: entra como movimentação pela RPC.
  if (quantidade) {
    await callRpc(req.db, RPC.registrarMovimentacaoEstoque, {
      materialId: material.id, tipo: 'entrada', quantidade, observacao: 'Estoque inicial',
    });
  }
  res.status(201).json(material);
}));

router.patch('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(async (req, res) => {
  const current = await loadMaterial(req);
  const { marca, lote, compatibilidade, quantidade_estoque: quantidadeEstoque, ...fields } = req.body;
  const caracteristicas = compact({ ...(current.caracteristicas || {}), marca, lote, compatibilidade });
  const changes = compact({ ...fields, caracteristicas });
  if (!Object.keys(changes).length && quantidadeEstoque === undefined) throw badRequest('Nenhum campo para atualizar');
  const material = Object.keys(changes).length
    ? await updateRow(req.db, TABLES.materiais, req.params.id, changes)
    : current;
  if (quantidadeEstoque !== undefined) {
    const { data: saldo, error: saldoError } = await req.db
      .from(VIEWS.saldoEstoque)
      .select('saldo_atual')
      .eq(COLUMNS.materialId, req.params.id)
      .maybeSingle();
    if (saldoError) throw saldoError;
    const atual = Number(saldo?.saldo_atual || 0);
    const diferenca = quantidadeEstoque - atual;
    if (diferenca !== 0) {
      await callRpc(req.db, RPC.registrarMovimentacaoEstoque, {
        materialId: req.params.id,
        tipo: 'ajuste',
        quantidade: diferenca,
        observacao: 'Ajuste realizado pela tela de materiais',
      });
    }
  }
  res.json(material);
}));

// ---- Estoque ------------------------------------------------------------

router.get('/:id/movimentacoes', validate({ params: idParams, query: pagination }), asyncHandler(async (req, res) => {
  await loadMaterial(req);
  res.json(await listRows(req.db, TABLES.estoqueMovimentacoes, {
    filters: { [COLUMNS.materialId]: req.params.id }, ...req.validQuery,
  }));
}));

const movimentacaoBody = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('entrada'), quantidade: z.number().positive(), observacao: z.string().max(500).optional() }),
  // Ajuste pode ser negativo (perda, correção de inventário). O banco bloqueia saldo negativo.
  z.object({ tipo: z.literal('ajuste'), quantidade: z.number().refine((n) => n !== 0, 'Quantidade não pode ser zero'), observacao: z.string().min(3).max(500) }),
]);

// Saídas por produção são registradas pelo banco em concluir_producao.
router.post('/:id/movimentacoes', requireRole('instituicao'), validate({ params: idParams, body: movimentacaoBody }), asyncHandler(async (req, res) => {
  await loadMaterial(req);
  const result = await callRpc(req.db, RPC.registrarMovimentacaoEstoque, { materialId: req.params.id, ...req.body });
  res.status(201).json(result ?? { ok: true });
}));

router.put('/:id/estoque-minimo', requireRole('aacd'), validate({
  params: idParams,
  body: z.object({ estoque_minimo: z.number().min(0) }),
}), asyncHandler(async (req, res) => {
  await callRpc(req.db, RPC.definirEstoqueMinimo, { materialId: req.params.id, minimo: req.body.estoque_minimo });
  res.json(await getRow(req.db, TABLES.materiais, req.params.id));
}));

export default router;
