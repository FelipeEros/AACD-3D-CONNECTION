import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID } from './fake-supabase.js';

test('login devolve tokens e perfil', async () => {
  const res = await request(buildApp(createFakeSupabase()))
    .post('/api/auth/login').send({ email: 'inst@hosp.org', senha: 'senha-correta' });
  assert.equal(res.status, 200);
  assert.equal(res.body.access_token, 'inst-token');
  assert.equal(res.body.usuario.perfil, 'instituicao');
  assert.equal(res.body.usuario.instituicao_id, INST_ID);
});

test('login com senha errada retorna 401', async () => {
  const res = await request(buildApp(createFakeSupabase()))
    .post('/api/auth/login').send({ email: 'inst@hosp.org', senha: 'x' });
  assert.equal(res.status, 401);
});

test('login valida o corpo', async () => {
  const res = await request(buildApp(createFakeSupabase())).post('/api/auth/login').send({ email: 'sem-arroba' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.length >= 1);
});

test('rotas protegidas exigem token válido', async () => {
  const app = buildApp(createFakeSupabase());
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set(auth('token-falso'))).status, 401);
  const me = await request(app).get('/api/auth/me').set(auth('aacd-token'));
  assert.equal(me.status, 200);
  assert.equal(me.body.perfil, 'aacd');
});

test('refresh renova a sessão', async () => {
  const res = await request(buildApp(createFakeSupabase())).post('/api/auth/refresh').send({ refresh_token: 'r' });
  assert.equal(res.status, 200);
  assert.equal(res.body.refresh_token, 'r2');
});

test('recuperar senha sempre responde 202', async () => {
  const sb = createFakeSupabase();
  const res = await request(buildApp(sb)).post('/api/auth/recuperar-senha').send({ email: 'x@y.com' });
  assert.equal(res.status, 202);
  assert.ok(sb.calls.some((c) => c.auth === 'reset'));
});

test('troca de senha confere a senha atual', async () => {
  const sb = createFakeSupabase();
  const app = buildApp(sb);
  const wrong = await request(app).put('/api/auth/senha').set(auth('inst-token'))
    .send({ senha_atual: 'errada', nova_senha: 'novaSenha123' });
  assert.equal(wrong.status, 401);
  const ok = await request(app).put('/api/auth/senha').set(auth('inst-token'))
    .send({ senha_atual: 'senha-correta', nova_senha: 'novaSenha123' });
  assert.equal(ok.status, 204);
  assert.ok(sb.calls.some((c) => c.auth === 'updateUser'));
});
