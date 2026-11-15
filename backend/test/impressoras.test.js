import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID, OTHER_INST_ID } from './fake-supabase.js';

const PRINTER_ID = '44444444-4444-4444-8444-444444444444';
const MAT_ID = '55555555-5555-4555-8555-555555555555';
const body = { nome: 'Prusa 01', fabricante: 'Prusa', modelo: 'MK4', numero_serie: 'SN1', tecnologia: 'FDM' };

const withPrinter = (instituicaoId = INST_ID) => createFakeSupabase({
  query: (q) => {
    if (q.table === 'impressoras' && q.op === 'select' && q.single) return { data: { id: PRINTER_ID, instituicao_id: instituicaoId }, error: null };
    if (q.op === 'insert') return { data: { id: PRINTER_ID, ...q.values }, error: null };
    return undefined;
  },
});

test('instituição cadastra impressora na própria instituição com materiais', async () => {
  const sb = withPrinter();
  const res = await request(buildApp(sb)).post('/api/impressoras').set(auth('inst-token'))
    .send({ ...body, material_ids: [MAT_ID] });
  assert.equal(res.status, 201);
  const inserts = sb.calls.filter((c) => c.op === 'insert');
  assert.equal(inserts[0].values.instituicao_id, INST_ID);
  assert.equal(inserts[0].values.status, undefined);
  assert.deepEqual(inserts[1].values, { impressora_id: PRINTER_ID, material_id: MAT_ID });
});

test('instituição não cadastra impressora para outra instituição', async () => {
  const res = await request(buildApp(withPrinter())).post('/api/impressoras').set(auth('inst-token'))
    .send({ ...body, instituicao_id: OTHER_INST_ID });
  assert.equal(res.status, 403);
});

test('AACD precisa informar a instituição', async () => {
  const res = await request(buildApp(withPrinter())).post('/api/impressoras').set(auth('aacd-token')).send(body);
  assert.equal(res.status, 400);
});

test('listagem da instituição é filtrada pela própria instituição', async () => {
  const sb = withPrinter();
  await request(buildApp(sb)).get('/api/impressoras?status=disponivel').set(auth('inst-token'));
  const q = sb.calls.at(-1);
  assert.ok(q.filters.some((f) => f[1] === 'instituicao_id' && f[2] === INST_ID));
  assert.ok(q.filters.some((f) => f[1] === 'status' && f[2] === 'disponivel'));
});

test('disponibilidade usa RPC e não aceita "ocupada"', async () => {
  const sb = withPrinter();
  const app = buildApp(sb);
  const bad = await request(app).patch(`/api/impressoras/${PRINTER_ID}/disponibilidade`).set(auth('inst-token')).send({ status: 'ocupada' });
  assert.equal(bad.status, 400);
  const ok = await request(app).patch(`/api/impressoras/${PRINTER_ID}/disponibilidade`).set(auth('inst-token')).send({ status: 'indisponivel' });
  assert.equal(ok.status, 200);
  assert.deepEqual(sb.calls.find((c) => c.rpc).args, { p_impressora_id: PRINTER_ID, p_status: 'indisponivel' });
});

test('impressora de outra instituição retorna 403', async () => {
  const res = await request(buildApp(withPrinter(OTHER_INST_ID))).get(`/api/impressoras/${PRINTER_ID}`).set(auth('inst-token'));
  assert.equal(res.status, 403);
});

test('PATCH não permite alterar status diretamente', async () => {
  const res = await request(buildApp(withPrinter())).patch(`/api/impressoras/${PRINTER_ID}`).set(auth('inst-token')).send({ status: 'ocupada' });
  assert.equal(res.status, 400);
});
