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
 * M35-01 (BUG-79) — canonical serializer for hand-rolled table exports.
 *
 * The audit export (and several others) built CSV by mapping EVERY cell through
 * `"${cell}"`, including the header. Two problems: the header line came out as
 * `"createdAt","entityType",...`, which Excel/Sheets render with literal quotes
 * in some locales and which makes diffs noisy; and data cells were quoted even
 * when they contained nothing needing it.
 *
 * This writer implements RFC-4180 the conventional way:
 *  - the HEADER row is emitted unquoted (these are fixed ASCII identifiers that
 *    cannot contain a separator or a quote — asserted by the type of use, and
 *    covered by a unit test);
 *  - DATA cells are quoted ONLY when they contain `,`, `"`, CR or LF, per the
 *    RFC's minimal-quoting rule, with embedded quotes doubled.
 *
 * Kept separate from `toCsv` (which takes accessor columns and always emits a
 * BOM) because these callers already hold string[][], including a header array.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize a header row + data rows into a CSV string (no BOM). */
export function toCsvLines(headers: readonly string[], rows: Iterable<readonly (string | number | null | undefined)[]>): string {
  const headerLine = headers.join(',');
  const bodyLines = Array.from(rows, (row) => row.map(csvCell).join(','));
  return [headerLine, ...bodyLines].join('\r\n');
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
