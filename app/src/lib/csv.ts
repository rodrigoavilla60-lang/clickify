// Planilha no formato que o Excel em português abre direto: ";" separando colunas, vírgula decimal
// e BOM para os acentos. Função pura, testada em tests/csv.test.ts.

export type Cell = string | number | null | undefined | Date;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString().replace("T", " ").slice(0, 19);
  else if (typeof v === "number") s = Number.isFinite(v) ? String(v).replace(".", ",") : "";
  else s = v;
  // Fórmula injetada ("=", "+", "-", "@") vira texto: planilha aberta não executa nada.
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function centsToNumber(c: number | null | undefined): number | null {
  return c === null || c === undefined ? null : Math.round(c) / 100;
}

export function csvResponse(name: string, body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
