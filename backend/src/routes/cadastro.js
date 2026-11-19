import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate } from '../lib/validate.js';
import { RPC, callRpc } from '../config/schema.js';
import { TABLES } from '../config/schema.js';
import { insertRow } from '../lib/query.js';

const router = Router();

const onlyDigits = (v) => v.replace(/\D/g, '');

export const cadastroBody = z.object({
  nome: z.string().trim().min(2).max(200),
  cnpj: z.string().transform(onlyDigits).pipe(z.string().length(14, 'CNPJ deve ter 14 dígitos')),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().transform(onlyDigits).pipe(z.string().min(10).max(11)),
  endereco: z.string().trim().min(5).max(300),
  responsavel: z.string().trim().min(2).max(150),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(72),
});

/**
 * Cadastro público de instituição (Tela_Cadastro). Fica PENDENTE e sem
 * senha até a AACD aprovar. Executado no servidor, conforme o guia.
 */
router.post('/', validate({ body: cadastroBody }), asyncHandler(async (req, res) => {
  const admin = req.app.locals.supabase.admin();
  let data;

  try {
    data = await callRpc(admin, RPC.solicitarCadastroInstituicao, req.body);
  } catch (error) {
    if (error?.code !== 'PGRST202') throw error;

    let instituicaoDados = {
      nome: req.body.nome,
      cnpj: req.body.cnpj,
      email: req.body.email,
      telefone: req.body.telefone,
      responsavel: req.body.responsavel,
      status: 'pendente',
    };

    while (true) {
      try {
        data = await insertRow(admin, TABLES.instituicoes, instituicaoDados);
        break;
      } catch (insertError) {
        if (insertError?.code !== 'PGRST204') throw insertError;
        const match = String(insertError.message || '').match(/['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/);
        const colunaAusente = match?.[1];
        if (!colunaAusente || !(colunaAusente in instituicaoDados)) throw insertError;
        delete instituicaoDados[colunaAusente];
      }
    }
  }

  const instituicaoId = typeof data === 'string' ? data : data?.id ?? null;
  const lista = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (lista.error) throw lista.error;
  let usuario = lista.data?.users?.find((item) => item.email?.toLowerCase() === req.body.email);

  if (!usuario) {
    const criado = await admin.auth.admin.createUser({
      email: req.body.email,
      password: req.body.senha,
      email_confirm: true,
    });
    if (criado.error) throw criado.error;
    usuario = criado.data?.user;
  }

  res.status(201).json({
    message: 'Cadastro recebido. A AACD vai analisar a solicitação. Após a aprovação, use este e-mail e senha para entrar.',
    instituicao_id: instituicaoId,
    usuario_id: usuario?.id ?? null,
  });
}));

export default router;
