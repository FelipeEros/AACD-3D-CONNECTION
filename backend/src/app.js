import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { notFoundHandler, errorHandler } from './middlewares/error.js';
import authRoutes from './routes/auth.js';
import cadastroRoutes from './routes/cadastro.js';
import instituicoesRoutes from './routes/instituicoes.js';
import impressorasRoutes from './routes/impressoras.js';
import materiaisRoutes from './routes/materiais.js';
import estoqueRoutes from './routes/estoque.js';
import solicitacoesRoutes from './routes/solicitacoes.js';
import mensagensRoutes from './routes/mensagens.js';
import arquivosRoutes from './routes/arquivos.js';
import dashboardRoutes from './routes/dashboard.js';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './docs/openapi.js';
import { requireAuth } from './middlewares/auth.js';

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
    // Limite mais rígido contra tentativas de senha.
    app.use(['/api/auth/login', '/api/auth/recuperar-senha', '/api/cadastro'],
      rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));
  }

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/openapi.json', (req, res) => res.json(openapi));
  // A interface do Swagger usa scripts inline: CSP relaxado só nesta rota.
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api/auth', authRoutes);
  app.use('/api/cadastro', cadastroRoutes);

  // Daqui em diante todas as rotas exigem login.
  app.use('/api/instituicoes', requireAuth, instituicoesRoutes);
  app.use('/api/impressoras', requireAuth, impressorasRoutes);
  app.use('/api/materiais', requireAuth, materiaisRoutes);
  app.use('/api/estoque', requireAuth, estoqueRoutes);
  app.use('/api/solicitacoes', requireAuth, solicitacoesRoutes);
  app.use('/api/mensagens', requireAuth, mensagensRoutes);
  app.use('/api/arquivos', requireAuth, arquivosRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
