// Reaproveita o módulo de acesso ao banco mantido em ../database.
import {
  createUserClient,
  createPublicClient,
  createAdminClient,
} from '../../../database/src/index.js';

/**
 * Fábrica de clientes Supabase. Requisições comuns SEMPRE usam o JWT do
 * usuário (forUser) para respeitar RLS. O cliente admin é usado apenas nas
 * operações de servidor descritas no guia (cadastro e vínculo de conta).
 */
export function createSupabaseFactory(env) {
  const base = { url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY };
  let adminClient;
  return {
    forUser: (accessToken) => createUserClient({ ...base, accessToken }),
    public: () => createPublicClient(base),
    admin: () => {
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada: operação de servidor indisponível');
      }
      adminClient ??= createAdminClient({ url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY });
      return adminClient;
    },
  };
}
