// Gera CSV compatível com Excel em pt-BR (separador ";" e BOM UTF-8).
const escape = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Evita injeção de fórmulas ao abrir no Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toCsv(rows, columns) {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [cols.map(escape).join(';'), ...rows.map((r) => cols.map((c) => escape(r[c])).join(';'))];
  return `﻿${lines.join('\r\n')}`;
}

export function sendCsv(res, filename, rows, columns) {
  const date = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}-${date}.csv"`);
  res.send(toCsv(rows, columns));
}
