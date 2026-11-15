import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate } from '../lib/validate.js';
import { RPC, callRpc } from '../config/schema.js';

const router = Router();

const onlyDigits = (v) => v.replace(/\D/g, '');

export const cadastroBody = z.object({
  nome: z.string().trim().min(2).max(200),
  cnpj: z.string().transform(onlyDigits).pipe(z.string().length(14, 'CNPJ deve ter 14 dígitos')),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().transform(onlyDigits).pipe(z.string().min(10).max(11)),
  endereco: z.string().trim().min(5).max(300),
});

/**
 * Cadastro público de instituição (Tela_Cadastro). Fica PENDENTE e sem
 * senha até a AACD aprovar. Executado no servidor, conforme o guia.
 */
router.post('/', validate({ body: cadastroBody }), asyncHandler(async (req, res) => {
  const data = await callRpc(req.app.locals.supabase.admin(), RPC.solicitarCadastroInstituicao, req.body);
  res.status(201).json({
    message: 'Cadastro recebido. A AACD vai analisar a solicitação e enviar o acesso por e-mail.',
    instituicao_id: typeof data === 'string' ? data : data?.id ?? null,
  });
}));

export default router;
