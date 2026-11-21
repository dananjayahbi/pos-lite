'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeDate } from '@/lib/format';
import type { UnmatchedStatementRow } from '@/lib/services/reconciliation-import.core';

export interface StatementImportHistoryItem {
  id: string;
  filename: string;
  status: string;
  rowCount: number;
  matchedCount: number;
  discrepancyCount: number;
  unmatchedCount: number;
  unmatched: UnmatchedStatementRow[];
  parseError?: string | null;
  uploadedAt: string;
  completedAt?: string | null;
}

function statusTone(status: string): string {
  if (status === 'COMPLETED') return 'bg-green-50 text-green-700';
  if (status === 'FAILED') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-mist bg-linen/40 px-3 py-2">
      <p className="text-xs text-espresso/50">{label}</p>
      <p className={`font-display text-lg font-bold ${tone ?? 'text-espresso'}`}>{value}</p>
    </div>
  );
}

function UnmatchedRows({ rows }: { rows: UnmatchedStatementRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="mt-2 rounded-md border border-mist bg-white/60 p-2">
      <summary className="cursor-pointer text-xs font-medium text-espresso">
        Show {rows.length} unmatched row{rows.length === 1 ? '' : 's'}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-espresso/50">
            <tr>
              <th className="py-1 pr-3 font-medium">Waybill</th>
              <th className="py-1 pr-3 font-medium">Order ref</th>
              <th className="py-1 pr-3 font-medium">Amount</th>
              <th className="py-1 pr-3 font-medium">Fees</th>
              <th className="py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.waybill ?? row.orderRef ?? row.barcode ?? 'row'}-${index}`}>
                <td className="py-1 pr-3 font-mono text-espresso">{row.waybill ?? '-'}</td>
                <td className="py-1 pr-3 text-espresso">{row.orderRef ?? '-'}</td>
                <td className="py-1 pr-3 text-espresso">{row.amount ?? '-'}</td>
                <td className="py-1 pr-3 text-espresso">{row.fees ?? '-'}</td>
                <td className="py-1 text-espresso">{row.status ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * ARGUS #512 — the reconciliation page previously offered no evidence that an
 * import had matched anything. This shows the latest result summary and the
 * recent import history, including unmatched rows and parse failures.
 */
export function ImportHistory({ imports }: { imports: StatementImportHistoryItem[] }) {
  const latest = imports[0];

  return (
    <Card className="border-mist">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="font-display text-lg">Import history</CardTitle>
        <span className="shrink-0 text-xs text-espresso/50">
          {imports.length} recent import{imports.length === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat label="Rows read" value={latest.rowCount} />
            <SummaryStat label="Matched" value={latest.matchedCount} tone="text-green-700" />
            <SummaryStat
              label="Discrepancies"
              value={latest.discrepancyCount}
              tone="text-terracotta"
            />
            <SummaryStat
              label="Unmatched"
              value={latest.unmatchedCount}
              tone={latest.unmatchedCount > 0 ? 'text-amber-700' : 'text-espresso'}
            />
          </div>
        ) : null}

        {imports.length === 0 ? (
          <p className="text-sm text-espresso/60">No statements imported yet.</p>
        ) : (
          <div className="space-y-3">
            {imports.map((item) => (
              <div key={item.id} className="rounded-lg border border-mist p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-espresso">{item.filename}</p>
                    <p className="text-xs text-espresso/50">
                      {formatRelativeDate(item.uploadedAt) ?? item.uploadedAt}
                      {' · '}
                      {item.rowCount} rows, {item.matchedCount} matched,{' '}
                      {item.discrepancyCount} discrepanc
                      {item.discrepancyCount === 1 ? 'y' : 'ies'}, {item.unmatchedCount} unmatched
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>

                {item.parseError ? (
                  <p className="mt-2 text-xs text-red-600">{item.parseError}</p>
                ) : null}

                <UnmatchedRows rows={item.unmatched} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
