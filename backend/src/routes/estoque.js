import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, pagination, uuid } from '../lib/validate.js';
import { scopeInstituicao } from '../middlewares/auth.js';
import { listRows } from '../lib/query.js';
import { sendCsv } from '../lib/csv.js';
import { VIEWS, COLUMNS } from '../config/schema.js';

const router = Router();
const query = pagination.extend({ instituicao_id: uuid.optional() });

// Views de leitura (respeitam RLS). Sem ordenação fixa: as colunas das views
// não estão documentadas no guia.
const fromView = (view) => asyncHandler(async (req, res) => {
  const { limit, offset } = req.validQuery;
  res.json(await listRows(req.db, view, {
    filters: { [COLUMNS.instituicaoId]: scopeInstituicao(req, req.validQuery.instituicao_id) },
    orderBy: null, limit, offset,
  }));
});

router.get('/saldo', validate({ query }), fromView(VIEWS.saldoEstoque));
router.get('/alertas', validate({ query }), fromView(VIEWS.alertasEstoque));

// Botão "Exportar Relatório" da Tela_Materiais.
router.get('/relatorio.csv', validate({ query: z.object({ instituicao_id: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const rows = [];
  const filters = { [COLUMNS.instituicaoId]: scopeInstituicao(req, req.validQuery.instituicao_id) };
  for (let offset = 0; ; offset += 1000) {
    const page = await listRows(req.db, VIEWS.saldoEstoque, { filters, orderBy: null, limit: 1000, offset });
    rows.push(...page.data);
    if (page.data.length < 1000 || rows.length >= 20000) break;
  }
  sendCsv(res, 'relatorio-materiais', rows);
}));

export default router;
