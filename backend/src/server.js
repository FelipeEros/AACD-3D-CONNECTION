import { loadEnv } from './config/env.js';
import { createSupabaseFactory } from './lib/supabase.js';
import { createApp } from './app.js';

const env = loadEnv();
const app = createApp({ env, supabase: createSupabaseFactory(env) });

app.listen(env.PORT, () => {
  console.log(`AACD 3D Connect API ouvindo em http://localhost:${env.PORT}/api`);
});
