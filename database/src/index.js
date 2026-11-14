export { createUserClient, createPublicClient, createAdminClient } from './client.js';
export { createRepository, supportedTables } from './repositories/base.js';


export function createRepositories(client) {
  const names = [
    'instituicoes', 'usuarios', 'impressoras', 'materiais', 'impressora_materiais',
    'solicitacoes', 'itens_solicitacao', 'mensagens', 'arquivos', 'estoque_movimentacoes',
  ];
  return Object.freeze(Object.fromEntries(names.map(name => [name, createRepository(client, name)])));
}
import { createRepository } from './repositories/base.js';
