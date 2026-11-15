import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../lib/async.js';
import { validate, idParams, uuid } from '../lib/validate.js';
import { badRequest, forbidden, notFound, HttpError } from '../lib/errors.js';
import { scopeInstituicao } from '../middlewares/auth.js';
import { getRow, insertRow } from '../lib/query.js';
import { TABLES, COLUMNS, BUCKET } from '../config/schema.js';

const router = Router();

const ALLOWED = {
  '.stl': 'model/stl',
  '.obj': 'model/obj',
  '.3mf': 'model/3mf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function uploader(req, res, next) {
  const maxMb = req.app.locals.env.UPLOAD_MAX_MB;
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (r, file, cb) => {
      // O multer entrega o nome em latin1; converte para UTF-8 (acentos).
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED[ext]) return cb(badRequest(`Tipo não permitido. Use: ${Object.keys(ALLOWED).join(', ')}`));
      cb(null, true);
    },
  }).single('arquivo')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `Arquivo maior que ${maxMb} MB`));
    if (err instanceof multer.MulterError) return next(badRequest(err.message));
    next(err);
  });
}

// Nome seguro para o Storage: sem acentos, espaços ou caminhos.
export function safeName(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, path.extname(original))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'arquivo';
  return `${randomUUID()}-${base}${ext}`;
}

const uploadBody = z.object({
  mensagem_id: uuid.optional(),
  solicitacao_id: uuid.optional(),
}).refine((b) => !!b.mensagem_id !== !!b.solicitacao_id, 'Informe mensagem_id OU solicitacao_id');

/**
 * Upload (multipart/form-data, campo "arquivo").
 * - Instituição: apenas em mensagens que ela mesma enviou,
 *   caminho mensagens/{instituicao_id}/{nome_unico} (definido no guia).
 * - AACD: em mensagens ou solicitações.
 */
router.post('/', uploader, validate({ body: uploadBody }), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Envie o arquivo no campo "arquivo"');
  const { mensagem_id: mensagemId, solicitacao_id: solicitacaoId } = req.body;

  let storagePath;
  if (mensagemId) {
    const msg = await getRow(req.db, TABLES.mensagens, mensagemId);
    if (!msg) throw notFound('Mensagem não encontrada');
    scopeInstituicao(req, msg[COLUMNS.instituicaoId]);
    if (!req.user.isAacd && msg[COLUMNS.remetenteId] !== req.user.id) {
      throw forbidden('Só é possível anexar arquivos às suas próprias mensagens');
    }
    storagePath = `mensagens/${msg[COLUMNS.instituicaoId]}/${safeName(req.file.originalname)}`;
  } else {
    if (!req.user.isAacd) throw forbidden('Apenas a AACD anexa arquivos a solicitações');
    const sol = await getRow(req.db, TABLES.solicitacoes, solicitacaoId);
    if (!sol) throw notFound('Solicitação não encontrada');
    storagePath = `solicitacoes/${solicitacaoId}/${safeName(req.file.originalname)}`;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const storage = req.db.storage.from(BUCKET);
  const { error: upErr } = await storage.upload(storagePath, req.file.buffer, {
    contentType: ALLOWED[ext], upsert: false,
  });
  if (upErr) throw upErr;

  try {
    const arquivo = await insertRow(req.db, TABLES.arquivos, {
      [COLUMNS.caminhoStorage]: storagePath,
      [COLUMNS.mensagemId]: mensagemId ?? null,
      [COLUMNS.solicitacaoId]: solicitacaoId ?? null,
      nome_original: req.file.originalname.slice(0, 255),
      tipo_mime: ALLOWED[ext],
      tamanho_bytes: req.file.size,
    });
    res.status(201).json(arquivo);
  } catch (err) {
    await storage.remove([storagePath]).catch(() => {}); // não deixa arquivo órfão
    throw err;
  }
}));

router.get('/', validate({
  query: z.object({ mensagem_id: uuid.optional(), solicitacao_id: uuid.optional() })
    .refine((q) => q.mensagem_id || q.solicitacao_id, 'Informe mensagem_id ou solicitacao_id'),
}), asyncHandler(async (req, res) => {
  const { mensagem_id: mensagemId, solicitacao_id: solicitacaoId } = req.validQuery;
  let q = req.db.from(TABLES.arquivos).select('*');
  if (mensagemId) q = q.eq(COLUMNS.mensagemId, mensagemId);
  if (solicitacaoId) q = q.eq(COLUMNS.solicitacaoId, solicitacaoId);
  const { data, error } = await q;
  if (error) throw error;
  res.json(data ?? []);
}));

// Link temporário (5 min). O bucket continua privado; a leitura do registro
// passa pela RLS do usuário antes de gerar o link.
router.get('/:id/download', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const arquivo = await getRow(req.db, TABLES.arquivos, req.params.id);
  if (!arquivo) throw notFound('Arquivo não encontrado');
  const { data, error } = await req.db.storage.from(BUCKET)
    .createSignedUrl(arquivo[COLUMNS.caminhoStorage], 300, { download: arquivo.nome_original ?? true });
  if (error) throw error;
  res.json({ url: data.signedUrl, expira_em_segundos: 300 });
}));

export default router;
