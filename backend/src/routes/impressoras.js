import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, idParams, pagination, uuid } from '../lib/validate.js';
import { notFound, badRequest, conflict } from '../lib/errors.js';
import { scopeInstituicao } from '../middlewares/auth.js';
import { listRows, getRow, insertRow, updateRow, compact } from '../lib/query.js';
import { TABLES, COLUMNS, RPC, STATUS_IMPRESSORA, callRpc } from '../config/schema.js';

const router = Router();
const text = (max = 200) => z.string().trim().min(1).max(max);

const impressoraFields = {
  nome: text(),
  fabricante: text(),
  modelo: text(),
  numero_serie: text(100),
  tecnologia: z.enum(['FDM', 'SLA', 'SLS', 'Outra']),
  observacoes: z.string().trim().max(1000).optional(),
};

const createBody = z.object({
  ...impressoraFields,
  instituicao_id: uuid.optional(), // apenas AACD pode informar
  material_ids: z.array(uuid).max(50).optional(),
}).strict();

const updateBody = z.object(Object.fromEntries(
  Object.entries(impressoraFields).map(([k, v]) => [k, v.optional()]),
)).extend({ material_ids: z.array(uuid).max(50).optional() }).strict();

const listQuery = pagination.extend({
  status: z.enum(STATUS_IMPRESSORA).optional(),
  tecnologia: z.string().optional(),
  instituicao_id: uuid.optional(),
  busca: z.string().optional(),
});

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { status, tecnologia, busca, limit, offset } = req.validQuery;
  const instituicaoId = scopeInstituicao(req, req.validQuery.instituicao_id);
  res.json(await listRows(req.db, TABLES.impressoras, {
    filters: { [COLUMNS.status]: status, tecnologia, [COLUMNS.instituicaoId]: instituicaoId },
    search: busca, searchColumns: ['nome', 'modelo'],
    orderBy: COLUMNS.nome, ascending: true, limit, offset,
  }));
}));

async function loadImpressora(req) {
  const row = await getRow(req.db, TABLES.impressoras, req.params.id);
  if (!row) throw notFound('Impressora não encontrada');
  scopeInstituicao(req, row[COLUMNS.instituicaoId]);
  return row;
}

async function listMateriaisCompativeis(db, impressoraId) {
  const { data, error } = await db
    .from(TABLES.impressoraMateriais)
    .select(`*, material:${TABLES.materiais}(*)`)
    .eq(COLUMNS.impressoraId, impressoraId);
  if (error) throw error;
  return data ?? [];
}

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const impressora = await loadImpressora(req);
  res.json({ ...impressora, materiais: await listMateriaisCompativeis(req.db, impressora.id) });
}));

router.post('/', validate({ body: createBody }), asyncHandler(async (req, res) => {
  const {
    material_ids: materialIds = [],
    instituicao_id: requested,
    fabricante,
    numero_serie: numeroSerie,
    observacoes,
    ...fields
  } = req.body;
  const instituicaoId = scopeInstituicao(req, requested);
  if (!instituicaoId) throw badRequest('Informe instituicao_id');

  // O status inicial é definido pelo banco.
  const especificacoes = { fabricante, numero_serie: numeroSerie, observacoes };
  const impressora = await insertRow(req.db, TABLES.impressoras, {
    ...fields,
    especificacoes: Object.fromEntries(Object.entries(especificacoes).filter(([, value]) => value)),
    [COLUMNS.instituicaoId]: instituicaoId,
  });
  for (const materialId of materialIds) {
    await insertRow(req.db, TABLES.impressoraMateriais, {
      [COLUMNS.impressoraId]: impressora.id, [COLUMNS.materialId]: materialId,
    });
  }
  res.status(201).json(impressora);
}));

router.delete('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  await loadImpressora(req);
  const { data: solicitacoes, error: solicitacoesError } = await req.db
    .from(TABLES.solicitacoes)
    .select('id')
    .eq(COLUMNS.impressoraId, req.params.id)
    .limit(1);
  if (solicitacoesError) throw solicitacoesError;
  if (solicitacoes?.length) {
    throw conflict('Não é possível excluir uma impressora vinculada a um pedido.');
  }

  const { error: vinculosError } = await req.db
    .from(TABLES.impressoraMateriais)
    .delete()
    .eq(COLUMNS.impressoraId, req.params.id);
  if (vinculosError) throw vinculosError;

  const { error } = await req.db.from(TABLES.impressoras)
    .delete()
    .eq('id', req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

router.patch('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(async (req, res) => {
  const current = await loadImpressora(req);
  const { fabricante, numero_serie: numeroSerie, observacoes, material_ids: materialIds, ...fields } = req.body;
  const specChanges = Object.fromEntries(
    Object.entries({ fabricante, numero_serie: numeroSerie, observacoes }).filter(([, value]) => value !== undefined),
  );
  const changes = compact(fields);
  if (Object.keys(specChanges).length) {
    changes.especificacoes = { ...(current.especificacoes || {}), ...specChanges };
  }
  if (!Object.keys(changes).length && materialIds === undefined) throw badRequest('Nenhum campo para atualizar');
  const updated = Object.keys(changes).length
    ? await updateRow(req.db, TABLES.impressoras, req.params.id, changes)
    : current;
  if (materialIds !== undefined) {
    const { error: deleteError } = await req.db.from(TABLES.impressoraMateriais)
      .delete()
      .eq(COLUMNS.impressoraId, req.params.id);
    if (deleteError) throw deleteError;
    for (const materialId of materialIds) {
      await insertRow(req.db, TABLES.impressoraMateriais, {
        [COLUMNS.impressoraId]: req.params.id, [COLUMNS.materialId]: materialId,
      });
    }
  }
  res.json(updated);
}));

// "ocupada" é controlado pelo banco (aceite/conclusão de pedidos).
router.patch('/:id/disponibilidade', validate({
  params: idParams,
  body: z.object({ status: z.enum(['disponivel', 'indisponivel']) }),
}), asyncHandler(async (req, res) => {
  await loadImpressora(req);
  await callRpc(req.db, RPC.alterarDisponibilidadeImpressora, { id: req.params.id, status: req.body.status });
  res.json(await getRow(req.db, TABLES.impressoras, req.params.id));
}));

// ---- Materiais compatíveis (impressora_materiais) ------------------------

router.get('/:id/materiais', validate({ params: idParams }), asyncHandler(async (req, res) => {
  await loadImpressora(req);
  res.json(await listMateriaisCompativeis(req.db, req.params.id));
}));

router.post('/:id/materiais', validate({
  params: idParams,
  body: z.object({ material_id: uuid }),
}), asyncHandler(async (req, res) => {
  await loadImpressora(req);
  res.status(201).json(await insertRow(req.db, TABLES.impressoraMateriais, {
    [COLUMNS.impressoraId]: req.params.id, [COLUMNS.materialId]: req.body.material_id,
  }));
}));

router.delete('/:id/materiais/:materialId', validate({
  params: z.object({ id: uuid, materialId: uuid }),
}), asyncHandler(async (req, res) => {
  await loadImpressora(req);
  const { data, error } = await req.db.from(TABLES.impressoraMateriais).delete()
    .eq(COLUMNS.impressoraId, req.params.id)
    .eq(COLUMNS.materialId, req.params.materialId)
    .select('*');
  if (error) throw error;
  if (!data?.length) throw notFound('Vínculo não encontrado');
  res.status(204).end();
}));

export default router;
