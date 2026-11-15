import { Router } from 'express';
import { asyncHandler } from '../lib/async.js';
import { countRows, listRows } from '../lib/query.js';
import { TABLES, VIEWS, COLUMNS, STATUS_SOLICITACAO, STATUS_IMPRESSORA } from '../config/schema.js';

const router = Router();

// Resumo para Tela_Dashboard (AACD: rede toda) e Tela_Dashboard_Parceira.
router.get('/', asyncHandler(async (req, res) => {
  const inst = req.user.isAacd ? {} : { [COLUMNS.instituicaoId]: req.user.instituicaoId };
  const byStatus = (table, statuses) => Promise.all(
    statuses.map(async (s) => [s, await countRows(req.db, table, { ...inst, [COLUMNS.status]: s })]),
  ).then(Object.fromEntries);

  const [impressoras, solicitacoes, materiais, alertas, recentes, instituicoes] = await Promise.all([
    byStatus(TABLES.impressoras, STATUS_IMPRESSORA),
    byStatus(TABLES.solicitacoes, STATUS_SOLICITACAO),
    countRows(req.db, TABLES.materiais, inst),
    countRows(req.db, VIEWS.alertasEstoque, inst),
    listRows(req.db, TABLES.solicitacoes, { filters: inst, limit: 5 }),
    req.user.isAacd ? countRows(req.db, TABLES.instituicoes) : null,
  ]);

  const total = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
  res.json({
    ...(instituicoes !== null && { instituicoes: { total: instituicoes } }),
    impressoras: { total: total(impressoras), por_status: impressoras },
    solicitacoes: { total: total(solicitacoes), por_status: solicitacoes },
    materiais: { total: materiais, alertas_estoque: alertas },
    solicitacoes_recentes: recentes.data,
  });
}));

export default router;
