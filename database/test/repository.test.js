import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, supportedTables } from '../src/repositories/base.js';

const ID = '11111111-1111-4111-8111-111111111111';
function fakeClient() {
  const calls = [];
  const query = {
    select(...args) { calls.push(['select', ...args]); return this; },
    range(...args) { calls.push(['range', ...args]); return Promise.resolve({data: [{id: ID}], error: null}); },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve({data: {id: ID}, error: null}); },
    single() { calls.push(['single']); return Promise.resolve({data: {id: ID}, error: null}); },
    insert(record) { calls.push(['insert', record]); return this; },
    update(changes) { calls.push(['update', changes]); return this; },
  };
  return { calls, from(table) { calls.push(['from', table]); return query; } };
}
test('cobre as dez tabelas esperadas', () => assert.equal(supportedTables.length, 10));
test('consulta lista com paginação segura', async () => {
  const c = fakeClient(); const result = await createRepository(c, 'instituicoes').list({limit: 10, offset: 20});
  assert.equal(result.length, 1); assert.deepEqual(c.calls.at(-1), ['range',20,29]);
});
test('consulta por UUID', async () => {
  const c = fakeClient(); await createRepository(c, 'materiais').getById(ID);
  assert.deepEqual(c.calls.find(c => c[0] === 'eq'), ['eq','id',ID]);
});
test('insere e atualiza sem lógica de negócio', async () => {
  const c = fakeClient(); const repo = createRepository(c, 'impressoras');
  await repo.insert({nome:'Teste'}); await repo.updateById(ID, {nome:'Novo'});
  assert.ok(c.calls.some(c => c[0] === 'insert')); assert.ok(c.calls.some(c => c[0] === 'update'));
});
test('rejeita tabela, id, registro e paginação inválidos', async () => {
  const c = fakeClient();
  assert.throws(() => createRepository(c, 'auth.users'));
  const repo = createRepository(c, 'instituicoes');
  await assert.rejects(() => repo.getById('abc'));
  await assert.rejects(() => repo.insert({}));
  await assert.rejects(() => repo.list({limit: 500}));
});
test('propaga erros do Supabase', async () => {
  const c = { from: () => ({select: () => ({range: async () => ({data:null,error:new Error('RLS')})})})};
  await assert.rejects(() => createRepository(c, 'instituicoes').list(), /RLS/);
});
