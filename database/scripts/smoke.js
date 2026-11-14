import { createPublicClient } from '../src/client.js';

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY antes do teste.');
  process.exitCode = 1;
} else {
  const client = createPublicClient({ url, publishableKey });
  const { error } = await client.auth.getSession();
  if (error) { console.error('Falha na configuração do cliente:', error.message); process.exitCode = 1; }
  else console.log('Cliente Supabase inicializado. Isso NÃO valida permissões de usuário nem conexão de leitura ao banco.');
}
