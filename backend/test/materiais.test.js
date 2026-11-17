import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID } from './fake-supabase.js';
import { toCsv } from '../src/lib/csv.js';

const MAT_ID = '55555555-5555-4555-8555-555555555555';
const body = { nome: 'PLA Branco', tipo: 'Filamento', marca: 'Voolt', lote: 'L1', cor: 'Branco', unidade: 'g' };

const sbMaterial = () => createFakeSupabase({
  query: (q) => {
    if (q.table === 'materiais' && q.single && q.op === 'select') return { data: { id: MAT_ID, instituicao_id: INST_ID }, error: null };
    if (q.op === 'insert') return { data: { id: MAT_ID, ...q.values }, error: null };
    if (q.table === 'vw_saldo_estoque') return { data: [{ material: '=CMD()', saldo: 3 }], error: null, count: 1 };
    return undefined;
  },
});

test('cadastro com quantidade inicial registra entrada via RPC', async () => {
  const sb = sbMaterial();
  const res = await request(buildApp(sb)).post('/api/materiais').set(auth('inst-token')).send({ ...body, quantidade_inicial: 5 });
  assert.equal(res.status, 201);
  const insert = sb.calls.find((c) => c.op === 'insert');
  assert.equal(insert.values.quantidade_inicial, undefined);
  const rpc = sb.calls.find((c) => c.rpc);
  assert.equal(rpc.rpc, 'registrar_movimentacao_estoque');
  assert.equal(rpc.args.p_tipo, 'entrada');
  assert.equal(rpc.args.p_quantidade, 5);
});

test('entrada exige quantidade positiva e ajuste exige observação', async () => {
  const app = buildApp(sbMaterial());
  const url = `/api/materiais/${MAT_ID}/movimentacoes`;
  assert.equal((await request(app).post(url).set(auth('inst-token')).send({ tipo: 'entrada', quantidade: -1 })).status, 400);
  assert.equal((await request(app).post(url).set(auth('inst-token')).send({ tipo: 'ajuste', quantidade: -1 })).status, 400);
  assert.equal((await request(app).post(url).set(auth('inst-token')).send({ tipo: 'saida', quantidade: 1 })).status, 400);
  assert.equal((await request(app).post(url).set(auth('inst-token')).send({ tipo: 'ajuste', quantidade: -1, observacao: 'perda' })).status, 201);
});

test('movimentação é da instituição; estoque mínimo é da AACD', async () => {
  const app = buildApp(sbMaterial());
  assert.equal((await request(app).post(`/api/materiais/${MAT_ID}/movimentacoes`).set(auth('aacd-token'))
    .send({ tipo: 'entrada', quantidade: 1 })).status, 403);
  assert.equal((await request(app).put(`/api/materiais/${MAT_ID}/estoque-minimo`).set(auth('inst-token'))
    .send({ estoque_minimo: 2 })).status, 403);
  assert.equal((await request(app).put(`/api/materiais/${MAT_ID}/estoque-minimo`).set(auth('aacd-token'))
    .send({ estoque_minimo: 2 })).status, 200);
});

test('saldo negativo bloqueado pelo banco vira 422', async () => {
  const sb = createFakeSupabase({
    query: (q) => (q.single ? { data: { id: MAT_ID, instituicao_id: INST_ID }, error: null } : undefined),
    rpc: () => ({ data: null, error: { code: 'P0001', message: 'Saldo insuficiente' } }),
  });
  const res = await request(buildApp(sb)).post(`/api/materiais/${MAT_ID}/movimentacoes`).set(auth('inst-token'))
    .send({ tipo: 'ajuste', quantidade: -100, observacao: 'perda' });
  assert.equal(res.status, 422);
});

test('relatório CSV protege contra fórmulas', async () => {
  const res = await request(buildApp(sbMaterial())).get('/api/estoque/relatorio.csv').set(auth('aacd-token'));
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.text, /"'=CMD\(\)"/);
});

test('toCsv usa ; e escapa aspas', () => {
  assert.equal(toCsv([{ a: 'x"y', b: 1 }]), '﻿"a";"b"\r\n"x""y";"1"');
});
