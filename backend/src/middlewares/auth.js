import { TABLES, COLUMNS, PERFIS } from '../config/schema.js';
import { unauthorized, forbidden } from '../lib/errors.js';

function bearerToken(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Carrega o perfil (tabela usuarios) do usuário autenticado. */
export async function loadProfile(client, authUserId) {
  const { data, error } = await client
    .from(TABLES.usuarios)
    .select('*')
    .eq(COLUMNS.usuarioAuthId, authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function toSessionUser(authUser, profile) {
  const perfil = profile[COLUMNS.usuarioPerfil];
  return {
    id: authUser.id,
    email: authUser.email,
    perfil,
    instituicaoId: profile[COLUMNS.instituicaoId] ?? null,
    isAacd: perfil === PERFIS.aacd,
    profile,
  };
}

/**
 * Exige um JWT válido do Supabase Auth. Define:
 *   req.db   -> cliente Supabase com o JWT do usuário (RLS aplicado)
 *   req.user -> { id, email, perfil, instituicaoId, isAacd, profile }
 */
export async function requireAuth(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) throw unauthorized('Envie o header Authorization: Bearer <token>');

    const db = req.app.locals.supabase.forUser(token);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) throw unauthorized('Sessão inválida ou expirada');

    const profile = await loadProfile(db, data.user.id);
    if (!profile) throw forbidden('Conta não vinculada a um usuário do sistema');

    req.token = token;
    req.db = db;
    req.user = toSessionUser(data.user, profile);
    next();
  } catch (err) {
    next(err);
  }
}

/** Restringe a rota a perfis específicos: requireRole('aacd'). */
export function requireRole(...perfis) {
  const allowed = perfis.map((p) => PERFIS[p] ?? p);
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.perfil)) return next(forbidden('Seu perfil não pode executar esta operação'));
    next();
  };
}

/**
 * Para usuários de instituição, força o filtro pela própria instituição.
 * A RLS do banco continua sendo a proteção principal; isto é defesa extra.
 */
export function scopeInstituicao(req, requestedId) {
  if (req.user.isAacd) return requestedId ?? null;
  if (requestedId && requestedId !== req.user.instituicaoId) throw forbidden('Acesso restrito à sua instituição');
  return req.user.instituicaoId;
}
