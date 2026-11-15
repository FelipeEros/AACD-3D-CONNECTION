# AACD 3D Connect — Backend

API REST em Node.js + Express sobre o **Supabase já existente** (PostgreSQL, Auth e Storage).
Reaproveita o módulo `../database` e segue o *Guia de integração para o Backend*:

- toda requisição comum usa o **JWT do usuário**, então as políticas **RLS** do banco valem sempre;
- mudanças de status e de estoque passam **somente pelas RPCs** do banco;
- a chave `service_role` é usada apenas no servidor, para o cadastro de instituição e para criar ou vincular a conta após a aprovação.

## Como rodar

Pré-requisito: Node.js 20.6 ou mais recente.

```bash
cd backend
npm install          # instala também as dependências de ../database
cp .env.example .env # preencha SUPABASE_URL e as chaves
npm run dev          # http://localhost:3000/api
```

- Documentação interativa (Swagger): `http://localhost:3000/api/docs`
- Testes (não acessam o Supabase real): `npm test`

## ⚠️ Antes de usar com o banco real: conferir `src/config/schema.js`

O guia confirma as tabelas, as views, os nomes das RPCs e os status. **Não** confirma os nomes de
todas as colunas, os argumentos das RPCs nem o formato do `jsonb` de `concluir_producao`.
Todas essas suposições estão reunidas em `src/config/schema.js` e marcadas com `CONFERIR`.
O próprio arquivo traz os dois SQLs para conferir no SQL Editor do Supabase.
Se algum nome estiver diferente, basta ajustar esse arquivo.

Itens a conferir, em resumo:

| O quê | Valor suposto |
|---|---|
| Coluna de `usuarios` com o id do Auth | `id` |
| Perfil do usuário | `usuarios.perfil` = `aacd` / `instituicao` |
| Chave da instituição nas tabelas | `instituicao_id` |
| Data de criação (ordenação) | `created_at` |
| Mensagem | `remetente_id`, `conteudo` |
| Arquivos | `caminho_storage`, `mensagem_id`, `solicitacao_id`, `nome_original`, `tipo_mime`, `tamanho_bytes` |
| Impressoras | `nome`, `fabricante`, `modelo`, `numero_serie`, `tecnologia`, `observacoes` |
| Materiais | `nome`, `tipo`, `marca`, `lote`, `cor`, `unidade` |
| Argumentos das RPCs | padrão `p_*` (ex.: `p_solicitacao_id`, `p_status`) |

## Perfis e permissões

| Ação | AACD | Instituição |
|---|:-:|:-:|
| Ver dados | todas as instituições | só a própria |
| Aprovar, rejeitar ou desativar instituição | ✅ | — |
| Cadastrar ou editar impressoras e materiais | ✅ (informando `instituicao_id`) | ✅ (próprios) |
| Alterar disponibilidade da impressora | — | ✅ |
| Criar ou cancelar solicitação | ✅ | — |
| Aceitar, recusar, iniciar produção ou concluir | — | ✅ |
| Registrar entrada ou ajuste de estoque | — | ✅ |
| Definir estoque mínimo | ✅ | — |
| Anexar arquivos | mensagens e solicitações | só às próprias mensagens |

As checagens da API são uma camada extra. Quem garante o isolamento entre instituições é a **RLS do banco**.

## Fluxos

**Cadastro → acesso.** `POST /api/cadastro` cria a instituição como pendente e sem senha.
A AACD chama `POST /api/instituicoes/:id/aprovar`. A API aprova pela RPC, envia um convite por
e-mail (Supabase Auth) e vincula a conta com `vincular_usuario_instituicao`. Se o convite falhar,
a aprovação continua valendo e o convite pode ser refeito em `POST /api/instituicoes/:id/vincular-usuario`.

**Solicitação.** `pendente → aceita → em_producao → concluida`. Uma solicitação pendente pode
ser `recusada` ou `cancelada`, e uma aceita pode ser `cancelada`. A AACD cria a solicitação já
com os itens. A API confere se a impressora é da instituição, se está disponível e se os materiais
são compatíveis. A conclusão exige o consumo real de **todos** os itens, e o banco faz a baixa do
estoque e libera a impressora.

**Anexos.** Ficam no bucket privado `arquivos`. A instituição envia para
`mensagens/{instituicao_id}/{nome_unico}`. O download é feito por um link temporário de 5 minutos.

## Usando no Frontend

```js
const API = 'http://localhost:3000/api';

// Login
const r = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, senha }),
});
const { access_token, refresh_token, usuario } = await r.json();

// Chamadas autenticadas
const pedidos = await fetch(`${API}/solicitacoes?status=pendente`, {
  headers: { Authorization: `Bearer ${access_token}` },
}).then((res) => res.json()); // { data, total, limit, offset }

// Upload de anexo
const form = new FormData();
form.append('arquivo', input.files[0]);
form.append('mensagem_id', mensagemId);
await fetch(`${API}/arquivos`, { method: 'POST', headers: { Authorization: `Bearer ${access_token}` }, body: form });
```

Quando a resposta for **401**, chame `POST /api/auth/refresh` com o `refresh_token`.

**Mensagens em tempo real.** Use o Supabase Realtime direto no navegador, com a chave pública e o
token do usuário. A RLS filtra o que cada usuário recebe. Antes, confirme no painel que o Realtime
está habilitado para a tabela `mensagens`.

```js
supabase.realtime.setAuth(access_token);
supabase.channel('mensagens')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens',
        filter: `instituicao_id=eq.${instituicaoId}` }, (payload) => mostrar(payload.new))
  .subscribe();
```

## Estrutura

```
src/
  app.js              montagem do Express (segurança, rotas, erros)
  server.js           ponto de entrada
  config/env.js       validação do .env
  config/schema.js    nomes de tabelas, colunas e RPCs (CONFERIR)
  middlewares/        auth (JWT + perfil), tratamento de erros
  routes/             auth, cadastro, instituicoes, impressoras, materiais,
                      estoque, solicitacoes, mensagens, arquivos, dashboard
  lib/                consultas, validação, CSV, erros
  docs/openapi.js     especificação Swagger
test/                 testes com Supabase simulado
```

## Erros

Os erros seguem o formato `{ "error": { "message": "...", "details": ... } }`.

| Status | Quando acontece |
|---|---|
| 400 | Dados inválidos (o campo `details` lista cada campo com problema) |
| 401 | Sem token ou sessão expirada |
| 403 | Perfil sem permissão ou bloqueio da RLS |
| 404 | Registro não encontrado |
| 409 | Registro duplicado ou relacionamento inválido |
| 413 | Arquivo grande demais |
| 422 | Regra de negócio recusada pelo banco (mensagem vinda da RPC) |

## Validação com o banco real (pendências do guia)

Teste com usuários reais da AACD e de uma instituição, **sem** usar a `service_role` nas requisições:

1. cadastro, aprovação e primeiro login da instituição;
2. instituição A **não** consegue ver dados da instituição B;
3. criação de solicitação, aceite, produção e conclusão, conferindo o estoque e o status da impressora;
4. upload e download de anexos.
