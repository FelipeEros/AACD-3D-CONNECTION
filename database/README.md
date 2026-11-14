# AACD 3D Connect — Módulo de acesso ao Supabase

Este diretório integra o **mesmo projeto** AACD-3D-CONNECTION. Não altera HTML/CSS/JS.

## Responsabilidade

Fornecer ao Backend Node.js funções reutilizáveis de leitura e escrita nas 10 tabelas `public`. **Não implementa** rotas HTTP, autenticação de login, autorização de negócios, controle de estoque, fluxos de produção nem transações multi-etapas. Todas essas operações pertencem à equipe Backend.

## Pré-requisitos

Node.js 20+ e npm. Execute no terminal:

```bash
cd AACD-3D-CONNECTION/database
npm install
npm test
```

Os testes são **locais e simulados**: não acessam nem alteram o Supabase real.

## Uso no Backend

```js
import { createUserClient, createRepositories } from './database/src/index.js';

// accessToken: JWT verificado/provido pelo fluxo de autenticação do Backend.
const client = createUserClient({
  url: process.env.SUPABASE_URL,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  accessToken,
});
const db = createRepositories(client);
const instituicoes = await db.instituicoes.list({limit: 20});
```

Para carregar `.env` no Node.js 20.6+ use `node --env-file=.env arquivo.js`, ou carregue variáveis no ambiente de execução. Nunca envie `.env` ao Git.

## Segurança

- O módulo `createUserClient` utiliza o JWT do usuário para **respeitar RLS**. Não confie apenas em checagens do Frontend.
- `createAdminClient` usa chave privilegiada que **ignora RLS**: restrita a rotinas internas e somente quando a equipe Backend implementar controles apropriados. Nunca expor no browser.
- A camada não filtra registros por instituição por conta própria: as políticas RLS devem ser testadas e revisadas.
- `updateById` e `insert` são operações primitivas. A equipe Backend deve validar campos permitidos e coordenar transações.
- Não há exclusão automática.

## Pendências conhecidas no banco

- Triggers ainda fazem transições de status, ocupação/liberação de impressora e baixa de estoque. A equipe Backend deve decidir a migração antes de executar essas regras por conta própria, para evitar dupla baixa.
- Bucket privado `arquivos`: verificar permissões de anexos de mensagens, pois o acesso a esses arquivos não está totalmente concluído.
- Verificar permissões e GRANTs para as operações pretendidas. Ter RLS ativo não garante que todas as escritas serão permitidas.
- O Frontend atual contém login **demonstrativo** e dados estáticos; este módulo não conecta automaticamente as telas nem autentica usuários.

## Próxima validação real

Com o Backend pronto, testar com usuários reais de AACD e instituição, sem usar service_role: consulta autorizada, acesso negado a outra instituição, inserções permitidas e leitura de arquivos. Não executar operações destrutivas em produção.
