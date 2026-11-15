'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';

type ComparisonStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'FEE_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'MISSING_IN_STATEMENT'
  | 'MISSING_IN_SYSTEM'
  | 'DUPLICATE_IN_STATEMENT'
  | 'MISSING_WAYBILL';

interface ComparisonIssue {
  code: ComparisonStatus;
  message: string;
}

interface ComparisonSide {
  deliveryId?: string;
  waybill: string | null;
  orderRef: string | null;
  cod: number | null;
  fees: number | null;
  status: string | null;
  date: string | null;
  settlementStatus?: string;
}

interface ComparisonRow {
  id: string;
  status: ComparisonStatus;
  severity: 'ok' | 'warning' | 'critical';
  waybill: string | null;
  orderRef: string | null;
  system: ComparisonSide | null;
  statement: ComparisonSide | null;
  codDifference: number | null;
  feeDifference: number | null;
  issues: ComparisonIssue[];
  message: string;
}

interface ComparisonReport {
  filename: string;
  range: { from: string; to: string };
  summary: {
    systemDeliveries: number;
    statementRows: number;
    matched: number;
    differences: number;
    missingInStatement: number;
    missingInSystem: number;
    duplicates: number;
    amountMismatches: number;
    feeMismatches: number;
    statusMismatches: number;
    systemCodTotal: number;
    statementCodTotal: number;
    variance: number;
    missingInStatementAmount: number;
    missingInSystemAmount: number;
    statementRowsOutsideRange: number;
  };
  rows: ComparisonRow[];
}

interface StatementComparisonProps {
  onCompare: (input: { file: File; from: string; to: string }) => Promise<ComparisonReport>;
  isComparing: boolean;
}

const STATUS_META: Record<ComparisonStatus, { label: string; tone: string }> = {
  MATCHED: { label: 'Matched', tone: 'bg-green-100 text-green-800' },
  AMOUNT_MISMATCH: { label: 'COD mismatch', tone: 'bg-red-100 text-red-800' },
  FEE_MISMATCH: { label: 'Charge mismatch', tone: 'bg-amber-100 text-amber-800' },
  STATUS_MISMATCH: { label: 'Status mismatch', tone: 'bg-amber-100 text-amber-800' },
  MISSING_IN_STATEMENT: { label: 'Missing in statement', tone: 'bg-red-100 text-red-800' },
  MISSING_IN_SYSTEM: { label: 'Not in system', tone: 'bg-red-100 text-red-800' },
  DUPLICATE_IN_STATEMENT: { label: 'Duplicate row', tone: 'bg-amber-100 text-amber-800' },
  MISSING_WAYBILL: { label: 'No waybill', tone: 'bg-amber-100 text-amber-800' },
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function money(value: number | null): string {
  return value === null ? '—' : formatRupee(value);
}

function signedMoney(value: number): string {
  if (value === 0) return formatRupee(0);
  return `${value > 0 ? '+' : '−'}${formatRupee(Math.abs(value))}`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Date-ranged, two-way comparison of our deliveries against the courier's
 * statement. This is a dry run: reviewing differences never settles anything.
 */
export function StatementComparison({ onCompare, isComparing }: StatementComparisonProps) {
  const [from, setFrom] = useState(() => defaultRange().from);
  const [to, setTo] = useState(() => defaultRange().to);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    if (!report) return [];
    const term = search.trim().toLowerCase();
    return report.rows.filter((row) => {
      if (onlyDifferences && row.status === 'MATCHED') return false;
      if (!term) return true;
      return (
        (row.waybill ?? '').toLowerCase().includes(term) ||
        (row.orderRef ?? '').toLowerCase().includes(term) ||
        (row.system?.deliveryId ?? '').toLowerCase().includes(term)
      );
    });
  }, [report, onlyDifferences, search]);

  const handleCompare = async () => {
    if (!file) return;
    setError(null);
    try {
      const result = await onCompare({ file, from, to });
      setReport(result);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : 'Could not compare the statement');
    }
  };

  const handleExport = () => {
    if (!report) return;
    const header = [
      'Status',
      'Waybill',
      'Order ref',
      'System COD',
      'Statement COD',
      'COD difference',
      'System fee',
      'Statement fee',
      'System status',
      'Statement status',
      'Explanation',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const row of report.rows) {
      lines.push(
        [
          row.status,
          row.waybill,
          row.orderRef,
          row.system?.cod ?? null,
          row.statement?.cod ?? null,
          row.codDifference,
          row.system?.fees ?? null,
          row.statement?.fees ?? null,
          row.system?.status ?? null,
          row.statement?.status ?? null,
          row.message,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `delivery-comparison-${report.range.from}_${report.range.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const summary = report?.summary;

  return (
    <Card className="border-mist">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <FileSpreadsheet className="h-5 w-5 text-terracotta" />
          Check courier statement
        </CardTitle>
        <p className="text-xs text-espresso/60">
          Upload the courier&apos;s Invoice Details sheet and compare it with our delivered orders.
          This is a dry run — nothing is settled or changed.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-body text-espresso/70">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-mist bg-pearl px-2 font-body text-sm text-espresso"
            />
          </label>
          <label className="text-xs font-body text-espresso/70">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-mist bg-pearl px-2 font-body text-sm text-espresso"
            />
          </label>
          <label className="text-xs font-body text-espresso/70 sm:col-span-2">
            Courier statement (.csv, .xlsx, .xls)
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setReport(null);
                setError(null);
              }}
              className="mt-1 block h-10 w-full cursor-pointer rounded-md border border-mist bg-pearl px-2 py-1.5 font-body text-xs text-espresso file:mr-3 file:rounded file:border-0 file:bg-linen file:px-2 file:py-1 file:text-espresso"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleCompare()}
            disabled={!file || isComparing}
            className="bg-espresso text-pearl hover:bg-espresso/90"
          >
            {isComparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isComparing ? 'Comparing…' : 'Compare statement'}
          </Button>
          <p className="font-body text-[11px] text-espresso/50">
            Matched by <span className="font-mono">WAYBILL ID</span> (order ref fallback).
            Columns read: collected COD, delivery charge, status, order date.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-[#FCE9E8] px-3 py-2 font-body text-sm text-[#9B2226]">
            {error}
          </p>
        )}

        {summary && report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="System deliveries" value={summary.systemDeliveries} />
              <SummaryCard label="Statement rows" value={summary.statementRows} />
              <SummaryCard
                label="Matched"
                value={summary.matched}
                tone="text-green-700"
              />
              <SummaryCard
                label="Differences"
                value={summary.differences}
                tone={summary.differences > 0 ? 'text-[#9B2226]' : 'text-green-700'}
              />
              <SummaryCard
                label="Missing in statement"
                value={summary.missingInStatement}
                hint={money(summary.missingInStatementAmount)}
                tone="text-[#9B2226]"
              />
              <SummaryCard
                label="Not in our system"
                value={summary.missingInSystem}
                hint={money(summary.missingInSystemAmount)}
                tone="text-[#9B2226]"
              />
              <SummaryCard
                label="COD variance"
                value={signedMoney(summary.variance)}
                hint={`System ${money(summary.systemCodTotal)} · Sheet ${money(summary.statementCodTotal)}`}
                tone={summary.variance === 0 ? 'text-green-700' : 'text-[#9B2226]'}
              />
              <SummaryCard
                label="Other checks"
                value={summary.amountMismatches + summary.feeMismatches + summary.statusMismatches + summary.duplicates}
                hint={`${summary.amountMismatches} COD · ${summary.feeMismatches} charge · ${summary.statusMismatches} status · ${summary.duplicates} duplicate`}
                tone="text-amber-700"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-mist/60 bg-linen/40 px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 font-body text-xs text-espresso">
                  <input
                    type="checkbox"
                    checked={onlyDifferences}
                    onChange={(event) => setOnlyDifferences(event.target.checked)}
                  />
                  Only show differences
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter by waybill or order ref"
                  className="h-9 w-64 rounded-md border border-mist bg-pearl px-2 font-body text-xs text-espresso"
                  aria-label="Filter comparison rows"
                />
                {summary.statementRowsOutsideRange > 0 && (
                  <span className="font-body text-[11px] text-espresso/50">
                    {summary.statementRowsOutsideRange} statement row(s) outside the selected range
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-body text-[11px] text-espresso/50">
                  {report.filename} · {report.range.from} → {report.range.to}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-4 font-body text-sm text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                {onlyDifferences
                  ? 'No differences in this range — every delivery tallies with the statement.'
                  : 'No rows matched the filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-mist/60">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead>
                    <tr className="bg-linen/60 font-body text-[11px] uppercase tracking-wide text-espresso/60">
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Waybill</th>
                      <th className="px-3 py-2">Order ref</th>
                      <th className="px-3 py-2 text-right">System COD</th>
                      <th className="px-3 py-2 text-right">Statement COD</th>
                      <th className="px-3 py-2 text-right">COD diff</th>
                      <th className="px-3 py-2 text-right">System fee</th>
                      <th className="px-3 py-2 text-right">Sheet fee</th>
                      <th className="px-3 py-2">Status found</th>
                      <th className="px-3 py-2">What is different</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const meta = STATUS_META[row.status];
                      return (
                        <tr
                          key={row.id}
                          className="border-t border-mist/40 align-top font-body text-xs text-espresso"
                        >
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{row.waybill ?? '—'}</td>
                          <td className="px-3 py-2 font-mono">{row.orderRef ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(row.system?.cod ?? null)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(row.statement?.cod ?? null)}</td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${
                              row.codDifference && row.codDifference !== 0 ? 'text-[#9B2226]' : ''
                            }`}
                          >
                            {row.codDifference === null ? '—' : signedMoney(row.codDifference)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{money(row.system?.fees ?? null)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(row.statement?.fees ?? null)}</td>
                          <td className="px-3 py-2">
                            <span className="text-espresso/70">{row.system?.status ?? '—'}</span>
                            <span className="mx-1 text-espresso/30">/</span>
                            <span className="text-espresso/70">{row.statement?.status ?? '—'}</span>
                          </td>
                          <td className="max-w-[360px] px-3 py-2">
                            <span className="flex items-start gap-1.5">
                              {row.severity !== 'ok' && (
                                <AlertTriangle
                                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                    row.severity === 'critical' ? 'text-[#9B2226]' : 'text-amber-600'
                                  }`}
                                />
                              )}
                              <span>{row.message}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-mist/60 bg-pearl px-3 py-2">
      <p className="font-body text-[11px] font-medium uppercase tracking-wide text-espresso/50">
        {label}
      </p>
      <p className={`font-display text-xl font-bold ${tone ?? 'text-espresso'}`}>{value}</p>
      {hint ? <p className="font-body text-[11px] text-espresso/50">{hint}</p> : null}
    </div>
  );
}
