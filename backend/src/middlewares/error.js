import { HttpError, fromSupabaseError } from '../lib/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Rota não encontrada: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed') err = new HttpError(400, 'JSON inválido');
  if (err?.type === 'entity.too.large') err = new HttpError(413, 'Requisição muito grande');
  const mapped = fromSupabaseError(err);
  if (mapped instanceof HttpError) {
    const body = { error: { message: mapped.message } };
    if (mapped.details) body.error.details = mapped.details;
    return res.status(mapped.status).json(body);
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { message: 'Erro interno do servidor' } });
}
