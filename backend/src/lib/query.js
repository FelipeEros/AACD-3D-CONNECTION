import { COLUMNS } from '../config/schema.js';

// Remove caracteres com significado na sintaxe de filtros do PostgREST.
export function sanitizeSearch(term) {
  return String(term ?? '').replace(/[,()*%\\:."']/g, ' ').trim().slice(0, 100);
}

/**
 * Lista paginada com filtros de igualdade e busca textual.
 * @returns {Promise<{ data: object[], total: number, limit: number, offset: number }>}
 */
export async function listRows(db, source, {
  filters = {},
  search,
  searchColumns = [],
  limit = 50,
  offset = 0,
  orderBy = COLUMNS.criadoEm,
  ascending = false,
  columns = '*',
} = {}) {
  let q = db.from(source).select(columns, { count: 'exact' });
  for (const [col, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    q = Array.isArray(value) ? q.in(col, value) : q.eq(col, value);
  }
  const term = sanitizeSearch(search);
  if (term && searchColumns.length) {
    q = q.or(searchColumns.map((c) => `${c}.ilike.*${term}*`).join(','));
  }
  if (orderBy) q = q.order(orderBy, { ascending });
  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) throw error;
  return { data: data ?? [], total: count ?? data?.length ?? 0, limit, offset };
}

export async function getRow(db, source, id, columns = '*') {
  const { data, error } = await db.from(source).select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertRow(db, source, values) {
  const { data, error } = await db.from(source).insert(values).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateRow(db, source, id, values) {
  const { data, error } = await db.from(source).update(values).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

/** Remove chaves undefined (campos não enviados num PATCH). */
export const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
