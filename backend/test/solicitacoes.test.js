import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID, OTHER_INST_ID } from './fake-supabase.js';

const SOL_ID = '66666666-6666-4666-8666-666666666666';
const PRINTER_ID = '44444444-4444-4444-8444-444444444444';
const MAT_OK = '55555555-5555-4555-8555-555555555555';
const MAT_BAD = '77777777-7777-4777-8777-777777777777';
const ITEM_ID = '88888888-8888-4888-8888-888888888888';

function sb({ printerStatus = 'disponivel', failItems = false, solInst = INST_ID } = {}) {
  return createFakeSupabase({
    query: (q) => {
      if (q.table === 'impressoras' && q.single) return { data: { id: PRINTER_ID, instituicao_id: INST_ID, status: printerStatus }, error: null };
      if (q.table === 'impressora_materiais') return { data: [{ material_id: MAT_OK }], error: null };
      if (q.table === 'solicitacoes' && q.op === 'insert') return { data: { id: SOL_ID, status: 'pendente', ...q.values }, error: null };
      if (q.table === 'solicitacoes' && q.single) return { data: { id: SOL_ID, instituicao_id: solInst, status: 'em_producao' }, error: null };
      if (q.table === 'itens_solicitacao' && q.op === 'insert') {
        return failItems ? { data: null, error: { code: '23503', message: 'fk' } } : { data: { id: ITEM_ID, ...q.values }, error: null };
      }
      if (q.table === 'itens_solicitacao') return { data: [{ id: ITEM_ID }], error: null };
      return undefined;
    },
  });
}

const novo = { instituicao_id: INST_ID, impressora_id: PRINTER_ID, itens: [{ material_id: MAT_OK, quantidade: 2 }] };

test('AACD cria solicitação com itens', async () => {
  const fake = sb();
  const res = await request(buildApp(fake)).post('/api/solicitacoes').set(auth('aacd-token')).send(novo);
  assert.equal(res.status, 201);
  assert.equal(res.body.itens.length, 1);
  assert.equal(fake.calls.find((c) => c.table === 'itens_solicitacao' && c.op === 'insert').values.solicitacao_id, SOL_ID);
});

test('instituição não cria solicitação', async () => {
  const res = await request(buildApp(sb())).post('/api/solicitacoes').set(auth('inst-token')).send(novo);
  assert.equal(res.status, 403);
});

test('rejeita material incompatível e impressora indisponível ou de outra instituição', async () => {
  const bad = await request(buildApp(sb())).post('/api/solicitacoes').set(auth('aacd-token'))
    .send({ ...novo, itens: [{ material_id: MAT_BAD, quantidade: 1 }] });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.error.details.material_ids, [MAT_BAD]);

  const off = await request(buildApp(sb({ printerStatus: 'indisponivel' }))).post('/api/solicitacoes').set(auth('aacd-token')).send(novo);
  assert.equal(off.status, 400);

  const other = await request(buildApp(sb())).post('/api/solicitacoes').set(auth('aacd-token')).send({ ...novo, instituicao_id: OTHER_INST_ID });
  assert.equal(other.status, 400);
});

test('falha nos itens cancela a solicitação criada', async () => {
  const fake = sb({ failItems: true });
  const res = await request(buildApp(fake)).post('/api/solicitacoes').set(auth('aacd-token')).send(novo);
  assert.equal(res.status, 409);
  assert.ok(fake.calls.some((c) => c.rpc === 'cancelar_solicitacao' && c.args.p_solicitacao_id === SOL_ID));
});

test('instituição aceita via RPC; status inválido é bloqueado', async () => {
  const fake = sb();
  const app = buildApp(fake);
  assert.equal((await request(app).post(`/api/solicitacoes/${SOL_ID}/status`).set(auth('inst-token')).send({ status: 'concluida' })).status, 400);
  assert.equal((await request(app).post(`/api/solicitacoes/${SOL_ID}/status`).set(auth('aacd-token')).send({ status: 'aceita' })).status, 403);
  const ok = await request(app).post(`/api/solicitacoes/${SOL_ID}/status`).set(auth('inst-token')).send({ status: 'aceita' });
  assert.equal(ok.status, 200);
  assert.deepEqual(fake.calls.find((c) => c.rpc).args, { p_solicitacao_id: SOL_ID, p_status: 'aceita' });
});

test('instituição não altera solicitação de outra instituição', async () => {
  const res = await request(buildApp(sb({ solInst: OTHER_INST_ID }))).post(`/api/solicitacoes/${SOL_ID}/status`)
    .set(auth('inst-token')).send({ status: 'aceita' });
  assert.equal(res.status, 403);
});

test('concluir exige consumo de todos os itens e chama a RPC', async () => {
  const fake = sb();
  const app = buildApp(fake);
  const url = `/api/solicitacoes/${SOL_ID}/concluir`;
  const unknown = await request(app).post(url).set(auth('inst-token')).send({ consumo: [{ item_id: MAT_BAD, quantidade_consumida: 1 }] });
  assert.equal(unknown.status, 400);
  const ok = await request(app).post(url).set(auth('inst-token')).send({ consumo: [{ item_id: ITEM_ID, quantidade_consumida: 0.4 }] });
  assert.equal(ok.status, 200);
  const rpc = fake.calls.find((c) => c.rpc === 'concluir_producao');
  assert.deepEqual(rpc.args.p_consumo, [{ item_id: ITEM_ID, quantidade_consumida: 0.4 }]);
});

test('filtro de status aceita lista separada por vírgula', async () => {
  const fake = sb();
  const res = await request(buildApp(fake)).get('/api/solicitacoes?status=concluida,cancelada').set(auth('aacd-token'));
  assert.equal(res.status, 200);
  assert.deepEqual(fake.calls.at(-1).filters.find((f) => f[1] === 'status'), ['in', 'status', ['concluida', 'cancelada']]);
  const bad = await request(buildApp(fake)).get('/api/solicitacoes?status=xyz').set(auth('aacd-token'));
  assert.equal(bad.status, 400);
});
