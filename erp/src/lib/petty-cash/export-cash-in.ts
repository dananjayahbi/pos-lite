/**
 * ARGUS #412 - the petty-cash audit CSV needs individual cash-in rows, not just
 * the aggregate "Cash In (Top-ups)" line. Kept pure so the section can be
 * tested without a database or a route.
 */
import { neutralizeCsvFormula, toCsv, type CsvColumn } from '@/lib/export';

export interface PettyCashCashInRow {
  entryDate: string;
  source: string;
  description: string;
  amount: number;
  recordedByEmail: string | null;
}

function safeText(value: string): string {
  return String(neutralizeCsvFormula(value) ?? '');
}

export function buildPettyCashCashInCsv(rows: readonly PettyCashCashInRow[]): string {
  const columns: CsvColumn<PettyCashCashInRow>[] = [
    { header: 'Date', value: (row) => row.entryDate.slice(0, 10) },
    { header: 'Source', value: (row) => safeText(row.source) },
    { header: 'Note', value: (row) => safeText(row.description) },
    { header: 'Recorded By', value: (row) => safeText(row.recordedByEmail ?? '') },
    { header: 'Amount', value: (row) => row.amount.toFixed(2) },
  ];
  return toCsv(columns, [...rows]);
}
