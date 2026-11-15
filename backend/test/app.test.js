import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { loadEnv } from '../src/config/env.js';

test('GET /api/health responde ok', async () => {
  const res = await request(buildApp()).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('rota inexistente retorna 404 em JSON', async () => {
  const res = await request(buildApp()).get('/api/nao-existe');
  assert.equal(res.status, 404);
  assert.match(res.body.error.message, /Rota não encontrada/);
});

test('JSON malformado retorna 400', async () => {
  const res = await request(buildApp()).post('/api/health').set('Content-Type', 'application/json').send('{x');
  assert.equal(res.status, 400);
});

test('loadEnv rejeita configuração incompleta', () => {
  assert.throws(() => loadEnv({}), /SUPABASE_URL/);
});
