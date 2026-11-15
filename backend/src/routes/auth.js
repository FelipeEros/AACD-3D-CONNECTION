import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate } from '../lib/validate.js';
import { unauthorized, forbidden, badRequest } from '../lib/errors.js';
import { requireAuth, loadProfile, toSessionUser } from '../middlewares/auth.js';

const router = Router();

const sessionPayload = (session, user) => ({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  usuario: { id: user.id, email: user.email, perfil: user.perfil, instituicao_id: user.instituicaoId },
});

const loginBody = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(1),
});

router.post('/login', validate({ body: loginBody }), asyncHandler(async (req, res) => {
  const { supabase } = req.app.locals;
  const { data, error } = await supabase.public().auth.signInWithPassword({
    email: req.body.email,
    password: req.body.senha,
  });
  if (error || !data?.session) throw unauthorized('E-mail ou senha incorretos');

  // Só libera acesso a contas já vinculadas (instituição aprovada ou AACD).
  const profile = await loadProfile(supabase.forUser(data.session.access_token), data.user.id);
  if (!profile) throw forbidden('Conta ainda não aprovada ou não vinculada a uma instituição');

  res.json(sessionPayload(data.session, toSessionUser(data.user, profile)));
}));

router.post('/refresh', validate({ body: z.object({ refresh_token: z.string().min(1) }) }), asyncHandler(async (req, res) => {
  const { data, error } = await req.app.locals.supabase.public().auth.refreshSession({
    refresh_token: req.body.refresh_token,
  });
  if (error || !data?.session) throw unauthorized('Refresh token inválido ou expirado');
  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}));

router.post('/recuperar-senha', validate({
  body: z.object({ email: z.string().trim().email(), redirect_to: z.string().url().optional() }),
}), asyncHandler(async (req, res) => {
  // Resposta sempre igual, para não revelar quais e-mails existem.
  await req.app.locals.supabase.public().auth.resetPasswordForEmail(req.body.email, {
    redirectTo: req.body.redirect_to,
  });
  res.status(202).json({ message: 'Se o e-mail estiver cadastrado, um link de recuperação será enviado.' });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ ...req.user.profile, perfil: req.user.perfil, email: req.user.email });
});

router.put('/senha', requireAuth, validate({
  body: z.object({ senha_atual: z.string().min(1), nova_senha: z.string().min(8, 'Mínimo de 8 caracteres') }),
}), asyncHandler(async (req, res) => {
  const { supabase } = req.app.locals;
  if (req.body.senha_atual === req.body.nova_senha) throw badRequest('A nova senha deve ser diferente da atual');

  const check = await supabase.public().auth.signInWithPassword({
    email: req.user.email,
    password: req.body.senha_atual,
  });
  if (check.error) throw unauthorized('Senha atual incorreta');

  const { error } = await supabase.admin().auth.admin.updateUserById(req.user.id, { password: req.body.nova_senha });
  if (error) throw error;
  res.status(204).end();
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  // Revoga os refresh tokens quando a chave de servidor está configurada.
  try {
    await req.app.locals.supabase.admin().auth.admin.signOut(req.token);
  } catch { /* sem service_role: o Frontend apenas descarta os tokens */ }
  res.status(204).end();
}));

export default router;
