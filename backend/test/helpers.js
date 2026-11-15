import { loadEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';

export const testEnv = loadEnv({
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-key',
  CORS_ORIGINS: 'http://localhost:5500',
});

export function buildApp(supabase = {}) {
  return createApp({ env: testEnv, supabase });
}
