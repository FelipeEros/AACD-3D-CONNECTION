import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, pagination, uuid } from '../lib/validate.js';
import { badRequest } from '../lib/errors.js';
import { scopeInstituicao } from '../middlewares/auth.js';
import { listRows, insertRow } from '../lib/query.js';
import { TABLES, COLUMNS } from '../config/schema.js';

/**
 * Mensagens: uma conversa por instituição (AACD <-> instituição).
 * Não há edição nem exclusão pelo usuário (regra do banco).
 * Tempo real: o Frontend assina a tabela "mensagens" pelo Supabase Realtime
 * (veja backend/README.md); esta API cuida de histórico e envio.
 */
const router = Router();

function instituicaoDaConversa(req, requested) {
  const id = scopeInstituicao(req, requested);
  if (!id) throw badRequest('Informe instituicao_id');
  return id;
}

// AACD: lista de conversas = instituições com a última atividade.
router.get('/conversas', validate({ query: pagination }), asyncHandler(async (req, res) => {
  const filters = req.user.isAacd ? {} : { id: req.user.instituicaoId };
  res.json(await listRows(req.db, TABLES.instituicoes, {
    filters, orderBy: COLUMNS.nome, ascending: true, ...req.validQuery,
  }));
}));

router.get('/', validate({
  query: pagination.extend({ instituicao_id: uuid.optional() }),
}), asyncHandler(async (req, res) => {
  const { limit, offset } = req.validQuery;
  // Mais recentes primeiro; o Frontend inverte para exibir.
  res.json(await listRows(req.db, TABLES.mensagens, {
    filters: { [COLUMNS.instituicaoId]: instituicaoDaConversa(req, req.validQuery.instituicao_id) },
    limit, offset,
  }));
}));

router.post('/', validate({
  body: z.object({
    instituicao_id: uuid.optional(),
    conteudo: z.string().trim().min(1, 'Mensagem vazia').max(5000),
  }).strict(),
}), asyncHandler(async (req, res) => {
  const mensagem = await insertRow(req.db, TABLES.mensagens, {
    [COLUMNS.instituicaoId]: instituicaoDaConversa(req, req.body.instituicao_id),
    [COLUMNS.remetenteId]: req.user.id, // remetente sempre o usuário autenticado
    [COLUMNS.conteudo]: req.body.conteudo,
  });
  res.status(201).json(mensagem);
}));

export default router;
