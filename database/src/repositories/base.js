const ALLOWED_TABLES = new Set([
  'instituicoes', 'usuarios', 'impressoras', 'materiais', 'impressora_materiais',
  'solicitacoes', 'itens_solicitacao', 'mensagens', 'arquivos', 'estoque_movimentacoes',
]);

function requireClient(client) {
  if (!client || typeof client.from !== 'function') throw new TypeError('Cliente Supabase inválido');
}
function requireTable(table) {
  if (!ALLOWED_TABLES.has(table)) throw new RangeError('Tabela não autorizada');
}
function requireId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new TypeError('ID UUID inválido');
  }
}
function requireRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).length === 0) {
    throw new TypeError('Registro deve ser um objeto não vazio');
  }
}
function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}


export function createRepository(client, table) {
  requireClient(client);
  requireTable(table);
  return Object.freeze({
    async list({ limit = 50, offset = 0 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
        throw new RangeError('Paginação inválida (limit 1–100; offset >= 0)');
      }
      return unwrap(await client.from(table).select('*').range(offset, offset + limit - 1));
    },
    async getById(id) {
      requireId(id);
      return unwrap(await client.from(table).select('*').eq('id', id).maybeSingle());
    },
    async insert(record) {
      requireRecord(record);
      return unwrap(await client.from(table).insert(record).select('*').single());
    },
    async updateById(id, changes) {
      requireId(id);
      requireRecord(changes);
      return unwrap(await client.from(table).update(changes).eq('id', id).select('*').single());
    },
  });
}

export const supportedTables = Object.freeze([...ALLOWED_TABLES]);
