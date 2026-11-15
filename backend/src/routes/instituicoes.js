import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, idParams, pagination, uuid } from '../lib/validate.js';
import { notFound, forbidden, badRequest } from '../lib/errors.js';
import { requireRole } from '../middlewares/auth.js';
import { listRows, getRow, updateRow, compact } from '../lib/query.js';
import { TABLES, COLUMNS, RPC, callRpc } from '../config/schema.js';

const router = Router();

const listQuery = pagination.extend({
  status: z.string().optional(),
  estado: z.string().length(2).toUpperCase().optional(),
  cidade: z.string().optional(),
  busca: z.string().optional(),
});

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { status, estado, cidade, busca, limit, offset } = req.validQuery;
  const filters = { [COLUMNS.status]: status, [COLUMNS.estado]: estado, [COLUMNS.cidade]: cidade };
  if (!req.user.isAacd) filters.id = req.user.instituicaoId;
  res.json(await listRows(req.db, TABLES.instituicoes, {
    filters, search: busca, searchColumns: [COLUMNS.nome, COLUMNS.cidade],
    orderBy: COLUMNS.nome, ascending: true, limit, offset,
  }));
}));

function assertOwnInstitution(req, id) {
  if (!req.user.isAacd && id !== req.user.instituicaoId) throw forbidden('Acesso restrito à sua instituição');
}

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  assertOwnInstitution(req, req.params.id);
  const row = await getRow(req.db, TABLES.instituicoes, req.params.id);
  if (!row) throw notFound('Instituição não encontrada');
  res.json(row);
}));

// Tela de Configurações: dados editáveis da instituição. Status e CNPJ
// não são alterados aqui (status muda apenas pelas RPCs da AACD).
const updateBody = z.object({
  nome: z.string().trim().min(2).max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  telefone: z.string().transform((v) => v.replace(/\D/g, '')).pipe(z.string().min(10).max(11)).optional(),
  endereco: z.string().trim().min(5).max(300).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().length(2).toUpperCase().optional(),
  responsavel: z.string().trim().max(200).optional(),
}).strict();

router.patch('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(async (req, res) => {
  assertOwnInstitution(req, req.params.id);
  const changes = compact(req.body);
  if (!Object.keys(changes).length) throw badRequest('Nenhum campo para atualizar');
  const row = await updateRow(req.db, TABLES.instituicoes, req.params.id, changes);
  if (!row) throw notFound('Instituição não encontrada');
  res.json(row);
}));

// ---- Decisões da AACD (RPCs) -------------------------------------------

/**
 * Cria (convite por e-mail) a conta Auth da instituição e vincula ao
 * cadastro aprovado. Operação de servidor: usa service_role.
 */
async function provisionarAcesso(supabase, instituicaoId, email) {
  const admin = supabase.admin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) throw error;
  await callRpc(admin, RPC.vincularUsuarioInstituicao, { usuarioId: data.user.id, instituicaoId });
  return { usuario_id: data.user.id, email };
}

router.post('/:id/aprovar', requireRole('aacd'), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const { id } = req.params;
  await callRpc(req.db, RPC.aprovarInstituicao, { id });

  const inst = await getRow(req.db, TABLES.instituicoes, id);
  const email = inst?.[COLUMNS.instituicaoEmail];
  let acesso;
  try {
    acesso = email
      ? { status: 'convite_enviado', ...(await provisionarAcesso(req.app.locals.supabase, id, email)) }
      : { status: 'pendente', motivo: 'Instituição sem e-mail cadastrado' };
  } catch (err) {
    // A aprovação já foi gravada; o acesso pode ser refeito em /vincular-usuario.
    acesso = { status: 'falhou', motivo: err.message };
  }
  res.json({ instituicao: inst, acesso });
}));

router.post('/:id/vincular-usuario', requireRole('aacd'), validate({
  params: idParams,
  body: z.object({ email: z.string().trim().toLowerCase().email().optional(), usuario_id: uuid.optional() })
    .refine((b) => b.email || b.usuario_id, 'Informe email ou usuario_id'),
}), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const inst = await getRow(req.db, TABLES.instituicoes, id);
  if (!inst) throw notFound('Instituição não encontrada');
  if (req.body.usuario_id) {
    await callRpc(req.app.locals.supabase.admin(), RPC.vincularUsuarioInstituicao, { usuarioId: req.body.usuario_id, instituicaoId: id });
    return res.json({ status: 'vinculado', usuario_id: req.body.usuario_id });
  }
  res.json({ status: 'convite_enviado', ...(await provisionarAcesso(req.app.locals.supabase, id, req.body.email)) });
}));

for (const [path, rpc] of [['rejeitar', RPC.rejeitarInstituicao], ['desativar', RPC.desativarInstituicao]]) {
  router.post(`/:id/${path}`, requireRole('aacd'), validate({ params: idParams }), asyncHandler(async (req, res) => {
    await callRpc(req.db, rpc, { id: req.params.id });
    res.json(await getRow(req.db, TABLES.instituicoes, req.params.id));
  }));
}

export default router;
