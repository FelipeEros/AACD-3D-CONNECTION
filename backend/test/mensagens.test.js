import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildApp } from './helpers.js';
import { createFakeSupabase, auth, INST_ID, INST_USER, AACD_USER, OTHER_INST_ID } from './fake-supabase.js';
import { safeName } from '../src/routes/arquivos.js';

const MSG_ID = '99999999-9999-4999-8999-999999999999';
const ARQ_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function sb({ remetente = INST_USER, insertError } = {}) {
  return createFakeSupabase({
    query: (q) => {
      if (q.table === 'mensagens' && q.single && q.op === 'select') return { data: { id: MSG_ID, instituicao_id: INST_ID, remetente_id: remetente }, error: null };
      if (q.table === 'arquivos' && q.op === 'insert' && insertError) return { data: null, error: insertError };
      if (q.op === 'insert') return { data: { id: ARQ_ID, ...q.values }, error: null };
      if (q.table === 'arquivos' && q.single) return { data: { id: ARQ_ID, caminho_storage: 'mensagens/x/y.stl', nome_original: 'y.stl' }, error: null };
      return undefined;
    },
  });
}

test('mensagem registra o remetente autenticado e a conversa da própria instituição', async () => {
  const fake = sb();
  const res = await request(buildApp(fake)).post('/api/mensagens').set(auth('inst-token')).send({ conteudo: ' Olá ' });
  assert.equal(res.status, 201);
  assert.deepEqual(fake.calls.at(-1).values, { instituicao_id: INST_ID, remetente_id: INST_USER, conteudo: 'Olá' });
});

test('não aceita remetente forjado nem conversa de outra instituição', async () => {
  const app = buildApp(sb());
  assert.equal((await request(app).post('/api/mensagens').set(auth('inst-token')).send({ conteudo: 'x', remetente_id: AACD_USER })).status, 400);
  assert.equal((await request(app).post('/api/mensagens').set(auth('inst-token')).send({ conteudo: 'x', instituicao_id: OTHER_INST_ID })).status, 403);
  assert.equal((await request(app).post('/api/mensagens').set(auth('aacd-token')).send({ conteudo: 'x' })).status, 400);
});

test('upload de STL pela instituição usa o caminho mensagens/{instituicao_id}/', async () => {
  const fake = sb();
  const res = await request(buildApp(fake)).post('/api/arquivos').set(auth('inst-token'))
    .field('mensagem_id', MSG_ID).attach('arquivo', Buffer.from('solid x'), 'Órtese punho v2.stl');
  assert.equal(res.status, 201);
  const up = fake.calls.find((c) => c.storage === 'upload');
  assert.equal(up.bucket, 'arquivos');
  assert.match(up.path, new RegExp(`^mensagens/${INST_ID}/[0-9a-f-]{36}-Ortese-punho-v2\\.stl$`));
  assert.equal(res.body.caminho_storage, up.path);
});

test('upload bloqueia extensão proibida e mensagem de outro remetente', async () => {
  const exe = await request(buildApp(sb())).post('/api/arquivos').set(auth('inst-token'))
    .field('mensagem_id', MSG_ID).attach('arquivo', Buffer.from('x'), 'virus.exe');
  assert.equal(exe.status, 400);
  const alheia = await request(buildApp(sb({ remetente: AACD_USER }))).post('/api/arquivos').set(auth('inst-token'))
    .field('mensagem_id', MSG_ID).attach('arquivo', Buffer.from('x'), 'a.stl');
  assert.equal(alheia.status, 403);
});

test('remove o arquivo do Storage se o registro falhar', async () => {
  const fake = sb({ insertError: { code: '42501', message: 'permission denied' } });
  const res = await request(buildApp(fake)).post('/api/arquivos').set(auth('inst-token'))
    .field('mensagem_id', MSG_ID).attach('arquivo', Buffer.from('x'), 'a.pdf');
  assert.equal(res.status, 403);
  assert.ok(fake.calls.some((c) => c.storage === 'remove'));
});

test('download devolve link temporário', async () => {
  const res = await request(buildApp(sb())).get(`/api/arquivos/${ARQ_ID}/download`).set(auth('inst-token'));
  assert.equal(res.status, 200);
  assert.match(res.body.url, /mensagens\/x\/y\.stl/);
});

test('safeName remove caminhos e caracteres especiais', () => {
  assert.match(safeName('../../etc/pass wd.STL'), /^[0-9a-f-]{36}-pass-wd\.stl$/);
});
