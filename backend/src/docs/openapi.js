// Especificação OpenAPI 3 servida em /api/docs.
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const page = [
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
  { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
];
const q = (name, schema = { type: 'string' }, description) => ({ name, in: 'query', schema, description });
const json = (properties, required = []) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', properties, required } } },
});
const s = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const num = { type: 'number' };
const ok = (description = 'OK') => ({ description });

const op = (tag, summary, extra = {}) => ({
  tags: [tag], summary, responses: { 200: ok(), 400: ok('Dados inválidos'), 401: ok('Não autenticado'), 403: ok('Sem permissão') }, ...extra,
});

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'AACD 3D Connect API',
    version: '1.0.0',
    description: 'Backend da rede AACD 3D Connect sobre o Supabase existente. '
      + 'Autentique em /auth/login e envie `Authorization: Bearer <access_token>`. '
      + 'Erros seguem o formato `{ "error": { "message", "details?" } }`.',
  },
  servers: [{ url: '/api' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  security: [{ bearer: [] }],
  paths: {
    '/health': { get: { tags: ['Sistema'], summary: 'Verifica se a API está no ar', security: [], responses: { 200: ok() } } },

    '/auth/login': { post: op('Autenticação', 'Login com e-mail e senha', { security: [], requestBody: json({ email: s, senha: s }, ['email', 'senha']) }) },
    '/auth/refresh': { post: op('Autenticação', 'Renova o access_token', { security: [], requestBody: json({ refresh_token: s }, ['refresh_token']) }) },
    '/auth/recuperar-senha': { post: op('Autenticação', 'Envia e-mail de recuperação', { security: [], requestBody: json({ email: s, redirect_to: s }, ['email']) }) },
    '/auth/me': { get: op('Autenticação', 'Perfil do usuário logado') },
    '/auth/senha': { put: op('Autenticação', 'Troca a senha', { requestBody: json({ senha_atual: s, nova_senha: s }, ['senha_atual', 'nova_senha']) }) },
    '/auth/logout': { post: op('Autenticação', 'Encerra a sessão') },

    '/cadastro': { post: op('Instituições', 'Cadastro público de instituição (fica pendente)', {
      security: [], requestBody: json({ nome: s, cnpj: s, email: s, telefone: s, endereco: s }, ['nome', 'cnpj', 'email', 'telefone', 'endereco']),
    }) },
    '/instituicoes': { get: op('Instituições', 'Lista instituições', { parameters: [...page, q('status'), q('estado'), q('cidade'), q('busca')] }) },
    '/instituicoes/{id}': {
      get: op('Instituições', 'Detalhe', { parameters: [id] }),
      patch: op('Instituições', 'Atualiza dados (Configurações)', { parameters: [id], requestBody: json({ nome: s, cnpj: s, email: s, telefone: s, cidade: s, estado: s, responsavel: s }) }),
    },
    '/instituicoes/{id}/aprovar': { post: op('Instituições', 'AACD aprova e envia convite de acesso', { parameters: [id] }) },
    '/instituicoes/{id}/rejeitar': { post: op('Instituições', 'AACD rejeita o cadastro', { parameters: [id] }) },
    '/instituicoes/{id}/desativar': { post: op('Instituições', 'AACD desativa (mantém histórico)', { parameters: [id] }) },
    '/instituicoes/{id}/vincular-usuario': { post: op('Instituições', 'AACD convida ou vincula um usuário', { parameters: [id], requestBody: json({ email: s, usuario_id: uuid }) }) },

    '/impressoras': {
      get: op('Impressoras', 'Lista impressoras', { parameters: [...page, q('status'), q('tecnologia'), q('instituicao_id'), q('busca')] }),
      post: op('Impressoras', 'Cadastra impressora', { requestBody: json({
        nome: s, fabricante: s, modelo: s, numero_serie: s, tecnologia: { type: 'string', enum: ['FDM', 'SLA', 'SLS', 'Outra'] },
        observacoes: s, instituicao_id: uuid, material_ids: { type: 'array', items: uuid },
      }, ['nome', 'fabricante', 'modelo', 'numero_serie', 'tecnologia']) }),
    },
    '/impressoras/{id}': {
      get: op('Impressoras', 'Detalhe com materiais compatíveis', { parameters: [id] }),
      patch: op('Impressoras', 'Atualiza dados', { parameters: [id] }),
    },
    '/impressoras/{id}/disponibilidade': { patch: op('Impressoras', 'Instituição altera disponibilidade', {
      parameters: [id], requestBody: json({ status: { type: 'string', enum: ['disponivel', 'indisponivel'] } }, ['status']),
    }) },
    '/impressoras/{id}/materiais': {
      get: op('Impressoras', 'Materiais compatíveis', { parameters: [id] }),
      post: op('Impressoras', 'Adiciona material compatível', { parameters: [id], requestBody: json({ material_id: uuid }, ['material_id']) }),
    },
    '/impressoras/{id}/materiais/{materialId}': { delete: op('Impressoras', 'Remove material compatível', {
      parameters: [id, { name: 'materialId', in: 'path', required: true, schema: uuid }],
    }) },

    '/materiais': {
      get: op('Materiais', 'Lista materiais', { parameters: [...page, q('tipo'), q('instituicao_id'), q('busca')] }),
      post: op('Materiais', 'Cadastra material', { requestBody: json({
        nome: s, tipo: { type: 'string', enum: ['Filamento', 'Resina', 'Pó', 'Outro'] }, marca: s, lote: s, cor: s,
        unidade: { type: 'string', enum: ['g'] }, quantidade_inicial: num, instituicao_id: uuid,
      }, ['nome', 'tipo', 'marca', 'lote', 'cor', 'unidade']) }),
    },
    '/materiais/{id}': { get: op('Materiais', 'Detalhe', { parameters: [id] }), patch: op('Materiais', 'Atualiza dados', { parameters: [id] }) },
    '/materiais/{id}/movimentacoes': {
      get: op('Estoque', 'Histórico de movimentações', { parameters: [id, ...page] }),
      post: op('Estoque', 'Instituição registra entrada ou ajuste', { parameters: [id], requestBody: json({
        tipo: { type: 'string', enum: ['entrada', 'ajuste'] }, quantidade: num, observacao: s,
      }, ['tipo', 'quantidade']) }),
    },
    '/materiais/{id}/estoque-minimo': { put: op('Estoque', 'AACD define estoque mínimo', { parameters: [id], requestBody: json({ estoque_minimo: num }, ['estoque_minimo']) }) },
    '/estoque/saldo': { get: op('Estoque', 'Saldo por material (vw_saldo_estoque)', { parameters: [...page, q('instituicao_id')] }) },
    '/estoque/alertas': { get: op('Estoque', 'Materiais abaixo do mínimo (vw_alertas_estoque)', { parameters: [...page, q('instituicao_id')] }) },
    '/estoque/relatorio.csv': { get: op('Estoque', 'Exporta o saldo em CSV', { parameters: [q('instituicao_id')] }) },

    '/solicitacoes': {
      get: op('Solicitações', 'Lista solicitações', { parameters: [...page, q('status', s, 'Um ou mais, separados por vírgula'), q('instituicao_id'), q('impressora_id')] }),
      post: op('Solicitações', 'AACD cria solicitação com itens', { requestBody: json({
        instituicao_id: uuid, impressora_id: uuid, prazo: { type: 'string', format: 'date' }, observacoes: s,
        itens: { type: 'array', items: { type: 'object', properties: { material_id: uuid, quantidade: num, observacoes: s }, required: ['material_id', 'quantidade'] } },
      }, ['instituicao_id', 'impressora_id', 'itens']) }),
    },
    '/solicitacoes/{id}': { get: op('Solicitações', 'Detalhe com itens', { parameters: [id] }) },
    '/solicitacoes/{id}/status': { post: op('Solicitações', 'Instituição aceita, recusa ou inicia produção', {
      parameters: [id], requestBody: json({ status: { type: 'string', enum: ['aceita', 'recusada', 'em_producao'] } }, ['status']),
    }) },
    '/solicitacoes/{id}/cancelar': { post: op('Solicitações', 'AACD cancela antes da produção', { parameters: [id] }) },
    '/solicitacoes/{id}/concluir': { post: op('Solicitações', 'Instituição conclui informando o consumo real', {
      parameters: [id], requestBody: json({ consumo: { type: 'array', items: { type: 'object', properties: { item_id: uuid, quantidade_consumida: num } } } }, ['consumo']),
    }) },

    '/mensagens/conversas': { get: op('Mensagens', 'Lista de conversas (instituições)', { parameters: page }) },
    '/mensagens': {
      get: op('Mensagens', 'Histórico da conversa (mais recentes primeiro)', { parameters: [...page, q('instituicao_id')] }),
      post: op('Mensagens', 'Envia mensagem', { requestBody: json({ conteudo: s, instituicao_id: uuid }, ['conteudo']) }),
    },
    '/arquivos': {
      get: op('Arquivos', 'Anexos de uma mensagem ou solicitação', { parameters: [q('mensagem_id'), q('solicitacao_id')] }),
      post: op('Arquivos', 'Upload de anexo (STL, OBJ, 3MF, PDF, PNG, JPG)', {
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          arquivo: { type: 'string', format: 'binary' }, mensagem_id: uuid, solicitacao_id: uuid,
        }, required: ['arquivo'] } } } },
      }),
    },
    '/arquivos/{id}/download': { get: op('Arquivos', 'Link temporário de download (5 min)', { parameters: [id] }) },
    '/dashboard': { get: op('Dashboard', 'Indicadores da rede ou da instituição') },
  },
};
