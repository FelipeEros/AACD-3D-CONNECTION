// Repassa erros de handlers async para o middleware de erro do Express 4.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
