import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID, OTHER_INST_ID } from './fake-supabase.js';

const cadastro = { nome: 'Hospital Teste', cnpj: '12.345.678/0001-90', email: 'Contato@Hosp.org', telefone: '(11) 99999-0000', endereco: 'Rua A, 100 - São Paulo', responsavel: 'Maria Silva', senha: 'senha-segura' };

test('cadastro público chama a RPC com dados normalizados', async () => {
  const sb = createFakeSupabase({ rpc: () => ({ data: INST_ID, error: null }) });
  const res = await request(buildApp(sb)).post('/api/cadastro').send(cadastro);
  assert.equal(res.status, 201);
  assert.equal(res.body.instituicao_id, INST_ID);
  const call = sb.calls.find((c) => c.rpc === 'solicitar_cadastro_instituicao');
  assert.equal(call.token, 'service-role');
  assert.equal(call.args.p_cnpj, '12345678000190');
  assert.equal(call.args.p_email, 'contato@hosp.org');
  assert.equal(call.args.p_responsavel, 'Maria Silva');
});

test('cadastro rejeita CNPJ inválido', async () => {
  const res = await request(buildApp(createFakeSupabase())).post('/api/cadastro').send({ ...cadastro, cnpj: '123' });
  assert.equal(res.status, 400);
});

test('cadastro cria a instituição diretamente quando o RPC ainda não existe', async () => {
  const sb = createFakeSupabase({
    rpc: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find function' } }),
    query: (q) => q.table === 'instituicoes' && q.op === 'insert'
      ? { data: { id: INST_ID, ...q.values }, error: null }
      : undefined,
  });
  const res = await request(buildApp(sb)).post('/api/cadastro').send(cadastro);
  assert.equal(res.status, 201);
  assert.equal(res.body.instituicao_id, INST_ID);
  assert.ok(sb.calls.some((c) => c.table === 'instituicoes' && c.op === 'insert'));
  assert.ok(sb.calls.some((c) => c.auth === 'createUser'));
});

test('instituição só lista a si mesma; AACD aplica filtros', async () => {
  const sb = createFakeSupabase();
  const app = buildApp(sb);
  await request(app).get('/api/instituicoes').set(auth('inst-token'));
  assert.deepEqual(sb.calls.at(-1).filters.find((f) => f[1] === 'id'), ['eq', 'id', INST_ID]);

  const res = await request(app).get('/api/instituicoes?estado=sp&status=ativa&busca=hosp,(x)').set(auth('aacd-token'));
  assert.equal(res.status, 200);
  const q = sb.calls.at(-1);
  assert.ok(q.filters.some((f) => f[1] === 'estado' && f[2] === 'SP'));
  assert.ok(!q.filters.some((f) => f[1] === 'id'));
  assert.ok(!q.filters.find((f) => f[0] === 'or')[1].includes('('));
});

test('instituição não acessa outra instituição', async () => {
  const app = buildApp(createFakeSupabase());
  const res = await request(app).get(`/api/instituicoes/${OTHER_INST_ID}`).set(auth('inst-token'));
  assert.equal(res.status, 403);
});

test('PATCH não aceita campos fora da lista', async () => {
  const app = buildApp(createFakeSupabase());
  const res = await request(app).patch(`/api/instituicoes/${INST_ID}`).set(auth('inst-token')).send({ status: 'ativa' });
  assert.equal(res.status, 400);
});

test('instituição atualiza CNPJ e normaliza telefone', async () => {
  const sb = createFakeSupabase({
    query: (q) => q.table === 'instituicoes' && q.op === 'update'
      ? { data: { id: INST_ID, ...q.values }, error: null }
      : undefined,
  });
  const res = await request(buildApp(sb)).patch(`/api/instituicoes/${INST_ID}`).set(auth('inst-token'))
    .send({ cnpj: '12.345.678/0001-90', telefone: '(11) 99999-0000' });
  assert.equal(res.status, 200);
  assert.deepEqual(sb.calls.at(-1).values, { cnpj: '12345678000190', telefone: '11999990000' });
  assert.equal(sb.calls.at(-1).token, 'service-role');
});

test('aprovar é exclusivo da AACD e provisiona o acesso', async () => {
  const sb = createFakeSupabase({
    query: (q) => (q.table === 'instituicoes' ? { data: { id: INST_ID, email: 'c@h.org' }, error: null } : undefined),
  });
  const app = buildApp(sb);
  assert.equal((await request(app).post(`/api/instituicoes/${INST_ID}/aprovar`).set(auth('inst-token'))).status, 403);

  const res = await request(app).post(`/api/instituicoes/${INST_ID}/aprovar`).set(auth('aacd-token'));
  assert.equal(res.status, 200);
  assert.equal(res.body.acesso.status, 'convite_enviado');
  const rpcs = sb.calls.filter((c) => c.rpc).map((c) => [c.rpc, c.token]);
  assert.deepEqual(rpcs, [['aprovar_instituicao', 'aacd-token'], ['vincular_usuario_instituicao', 'service-role']]);
});

test('erro de regra do banco (P0001) vira 422 com a mensagem', async () => {
  const sb = createFakeSupabase({ rpc: () => ({ data: null, error: { code: 'P0001', message: 'Instituição já aprovada' } }) });
  const res = await request(buildApp(sb)).post(`/api/instituicoes/${INST_ID}/rejeitar`).set(auth('aacd-token'));
  assert.equal(res.status, 422);
  assert.equal(res.body.error.message, 'Instituição já aprovada');
});
