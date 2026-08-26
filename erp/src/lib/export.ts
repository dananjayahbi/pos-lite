/**
 * Reusable server-side export utilities (doc 41).
 *
 * Produces downloadable CSV files with a `Content-Disposition` attachment
 * header. Kept dependency-free (no XLSX/PDF library) for a lightweight, greenfield
 * export capability; a richer format can be layered on later.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** RFC-4180-safe field: wraps values containing separators, quotes, or newlines. */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Serialize rows into a CSV string with a UTF-8 BOM (Excel-friendly). */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => csvEscape(c.value(row))).join(','),
  );
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

/**
 * Build a downloadable Response from CSV content. `filename` should include a
 * `.csv` extension.
 */
export function csvDownloadResponse(
  csv: string,
  filename: string,
): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
