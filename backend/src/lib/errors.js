export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Não autenticado') => new HttpError(401, msg);
export const forbidden = (msg = 'Acesso negado') => new HttpError(403, msg);
export const notFound = (msg = 'Recurso não encontrado') => new HttpError(404, msg);

// Converte erros do PostgREST/Supabase em respostas HTTP coerentes.
// Códigos: https://postgrest.org/en/stable/references/errors.html
export function fromSupabaseError(err) {
  if (!err || err instanceof HttpError) return err;
  const code = err.code ?? '';
  const message = err.message || 'Erro no banco de dados';
  if (code === '42501' || code === 'PGRST301' || /permission denied|row-level security/i.test(message)) {
    return new HttpError(403, 'Operação não permitida para este usuário');
  }
  if (code === 'PGRST116') return new HttpError(404, 'Recurso não encontrado');
  if (code === '23505') return new HttpError(409, 'Registro duplicado', { message });
  if (code === '23503') return new HttpError(409, 'Registro relacionado não existe ou está em uso', { message });
  if (code === '23514' || code === '23502' || code === '22P02') return new HttpError(422, 'Dados inválidos', { message });
  // RAISE EXCEPTION dentro das RPCs (regras de negócio do banco)
  if (code === 'P0001') return new HttpError(422, message);
  if (code === 'PGRST202') return new HttpError(500, 'Função RPC não encontrada: confira o nome e os argumentos em src/config/schema.js', { message });
  if (code.startsWith('PGRST') || /^\d{5}$/.test(code)) return new HttpError(400, message);
  return err;
}
