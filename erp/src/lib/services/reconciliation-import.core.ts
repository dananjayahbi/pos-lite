/**
 * ARGUS #512 — COD remittance import summaries + unmatched detail.
 *
 * The import route always toasted "Remittance statement imported", even when a
 * statement matched zero ledger entries. Unmatched rows were counted nowhere and
 * the page kept no history, so a completed import looked identical to a silent
 * no-op.
 *
 * `StatementImport.rawRows` is a JSON column, so the detail already fits the
 * schema: new imports store `{ rows, unmatched }`. Older imports stored a plain
 * array; the readers below tolerate both shapes.
 *
 * Pure: no prisma, no `server-only` — shared by the service, the hook and tests.
 */

export interface StatementImportCounts {
  rowCount: number;
  matchedCount: number;
  discrepancyCount: number;
  rawRows?: unknown;
}

export interface StatementImportSummary {
  rowCount: number;
  matchedCount: number;
  discrepancyCount: number;
  unmatchedCount: number;
}

export interface UnmatchedStatementRow {
  waybill: string | null;
  orderRef: string | null;
  barcode: string | null;
  amount: string | null;
  fees: string | null;
  status: string | null;
  date: string | null;
  payable: string | null;
}

export interface StatementRawRows {
  rows: Record<string, string>[];
  unmatched: UnmatchedStatementRow[];
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Normalise one parsed remittance row for storage in `rawRows.unmatched`. */
export function unmatchedRowFromParsed(row: {
  waybill?: string | undefined;
  orderRef?: string | undefined;
  barcode?: string | undefined;
  amount?: string | undefined;
  fees?: string | undefined;
  status?: string | undefined;
  date?: string | undefined;
  payable?: string | undefined;
}): UnmatchedStatementRow {
  return {
    waybill: text(row.waybill),
    orderRef: text(row.orderRef),
    barcode: text(row.barcode),
    amount: text(row.amount),
    fees: text(row.fees),
    status: text(row.status),
    date: text(row.date),
    payable: text(row.payable),
  };
}

/** Build the JSON payload persisted on a completed import. */
export function buildStatementRawRows(
  parsedRows: { raw: Record<string, string> }[],
  unmatchedRows: UnmatchedStatementRow[],
): StatementRawRows {
  return {
    rows: parsedRows.map((row) => row.raw),
    unmatched: unmatchedRows,
  };
}

/**
 * Read unmatched rows from either the structured shape or the legacy array.
 * A legacy array has no record of which rows failed to match, so it yields an
 * empty list and the summary falls back to row arithmetic.
 */
export function readUnmatchedRows(rawRows: unknown): UnmatchedStatementRow[] {
  const record = asRecord(rawRows);
  if (!record || !Array.isArray(record.unmatched)) return [];
  return record.unmatched
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => value !== null)
    .map((value) => ({
      waybill: text(value.waybill),
      orderRef: text(value.orderRef),
      barcode: text(value.barcode),
      amount: text(value.amount),
      fees: text(value.fees),
      status: text(value.status),
      date: text(value.date),
      payable: text(value.payable),
    }));
}

/**
 * Counts for one import. New imports use the stored unmatched list; legacy
 * imports derive the remainder (`rowCount - matched - discrepancies`).
 */
export function summarizeStatementImport(
  counts: StatementImportCounts,
): StatementImportSummary {
  const rowCount = Number.isFinite(counts.rowCount) ? counts.rowCount : 0;
  const matchedCount = Number.isFinite(counts.matchedCount) ? counts.matchedCount : 0;
  const discrepancyCount = Number.isFinite(counts.discrepancyCount)
    ? counts.discrepancyCount
    : 0;

  const stored = asRecord(counts.rawRows);
  const unmatchedCount = stored && Array.isArray(stored.unmatched)
    ? stored.unmatched.length
    : Math.max(0, rowCount - matchedCount - discrepancyCount);

  return { rowCount, matchedCount, discrepancyCount, unmatchedCount };
}

/** Operator-facing toast copy; never claims success when nothing matched. */
export function describeImportResult(summary: StatementImportSummary): string {
  const parts = [
    `${summary.rowCount} row${summary.rowCount === 1 ? '' : 's'} read`,
    `${summary.matchedCount} matched`,
    `${summary.discrepancyCount} discrepanc${summary.discrepancyCount === 1 ? 'y' : 'ies'}`,
    `${summary.unmatchedCount} unmatched`,
  ];
  return `Statement imported: ${parts.join(', ')}`;
}
