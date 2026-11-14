import { createClient } from '@supabase/supabase-js';


export function createUserClient({ url, publishableKey, accessToken }) {
  if (!url || !publishableKey || !accessToken) {
    throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e accessToken são obrigatórios');
  }
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}


export function createPublicClient({ url, publishableKey }) {
  if (!url || !publishableKey) throw new Error('URL e chave pública obrigatórias');
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}


export function createAdminClient({ url, serviceRoleKey }) {
  if (!url || !serviceRoleKey) throw new Error('URL e serviceRoleKey obrigatórias');
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
