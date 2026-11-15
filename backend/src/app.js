import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { notFoundHandler, errorHandler } from './middlewares/error.js';

/**
 * Cria a aplicação Express.
 * @param {object} deps
 * @param {object} deps.env       configuração validada (loadEnv)
 * @param {object} deps.supabase  fábrica de clientes ({ forUser, public, admin })
 */
export function createApp({ env, supabase }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.locals.env = env;
  app.locals.supabase = supabase;

  app.use(helmet());
  app.use(cors({
    origin: env.corsOrigins.length ? env.corsOrigins : false,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') {
    app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  }

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
