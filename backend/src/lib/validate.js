import { z } from 'zod';
import { badRequest } from './errors.js';

export const uuid = z.string().uuid('ID deve ser um UUID');

function parse(schema, value, where) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(`Dados inválidos em ${where}`, result.error.issues.map((i) => ({
      campo: i.path.join('.') || where,
      mensagem: i.message,
    })));
  }
  return result.data;
}

/** Middleware que valida e substitui req.body / req.query / req.params. */
export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (params) req.params = parse(params, req.params, 'params');
      if (query) req.validQuery = parse(query, req.query, 'query');
      if (body) req.body = parse(body, req.body ?? {}, 'body');
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const idParams = z.object({ id: uuid });

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
