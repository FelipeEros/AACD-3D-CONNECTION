import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID } from './fake-supabase.js';

const fake = () => createFakeSupabase({
  query: (q) => (q.selectOpts?.head ? { data: null, error: null, count: q.filters.some((f) => f[2] === 'pendente') ? 3 : 1 } : undefined),
});

test('dashboard da AACD inclui instituições e totais por status', async () => {
  const res = await request(buildApp(fake())).get('/api/dashboard').set(auth('aacd-token'));
  assert.equal(res.status, 200);
  assert.equal(res.body.instituicoes.total, 1);
  assert.equal(res.body.solicitacoes.por_status.pendente, 3);
  assert.equal(res.body.solicitacoes.total, 3 + 5);
  assert.equal(res.body.impressoras.total, 3);
});

test('dashboard da instituição filtra pela instituição e omite a rede', async () => {
  const sb = fake();
  const res = await request(buildApp(sb)).get('/api/dashboard').set(auth('inst-token'));
  assert.equal(res.status, 200);
  assert.equal(res.body.instituicoes, undefined);
  const counts = sb.calls.filter((c) => c.selectOpts?.head);
  assert.ok(counts.every((c) => c.filters.some((f) => f[1] === 'instituicao_id' && f[2] === INST_ID)));
});
