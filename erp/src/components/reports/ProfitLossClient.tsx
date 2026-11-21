"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportContext } from "@/lib/reports/ReportContext";
import { formatRupee } from "@/lib/format";
import { expenseCategoryLabel, reportMonthLabel } from "@/lib/reports/labels";
import { resolveReportErrorMessage } from "@/lib/reports/reportError";
import { buildProfitLossExportRows } from "@/lib/reports/reportRows";
import { paymentMethodLabel } from "@/lib/sales/payment-method-label";

// ── Helpers ──────────────────────────────────────────────────────

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toYMD(d);
}

function defaultTo(): string {
  return toYMD(new Date());
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtCurrency(val: string): string {
  return formatRupee(val);
}

// ── Types ────────────────────────────────────────────────────────

interface PaymentMethodRow {
  method: string;
  total: string;
}

interface ExpenseCategoryRow {
  category: string;
  total: string;
}

interface MonthlyRow {
  month: string;
  revenue: string;
  cogs: string;
  grossProfit: string;
  expenses: string;
  netProfit: string;
  saleCount: number;
}

interface CogsSourceSummary {
  total: number;
  snapshotCogs: number;
  fallbackCogs: number;
  snapshotLines: number;
  fallbackLines: number;
  totalLines: number;
  usesFallback: boolean;
  fallbackPercent: number;
  caveat: string | null;
}

interface CogsQuality {
  sales: CogsSourceSummary;
  returned: CogsSourceSummary;
  usesFallback: boolean;
  caveats: string[];
}

interface PLData {
  period: { from: string; to: string };
  grossRevenue: string;
  totalReturns: string;
  netRevenue: string;
  saleCount: number;
  returnCount: number;
  revenueByPaymentMethod: PaymentMethodRow[];
  rawCOGS: string;
  returnedCOGS: string;
  netCOGS: string;
  grossProfit: string;
  grossMargin: string;
  totalExpenses: string;
  expenseCategories: ExpenseCategoryRow[];
  netProfit: string;
  netMargin: string;
  cogsQuality: CogsQuality;
  monthlyData: MonthlyRow[];
}

interface PLResponse {
  success: boolean;
  data: PLData;
  error?: { code: string; message: string };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchPL(from: string, to: string): Promise<PLData> {
  const res = await fetch(
    `/api/reports/profit-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  // Read the envelope even on a non-2xx response so a typed server error
  // (VALIDATION_ERROR, INTERNAL_ERROR, ...) is shown instead of a generic
  // "Failed to fetch report".
  const json = (await res.json().catch(() => null)) as PLResponse | null;
  if (!res.ok) {
    throw new Error(resolveReportErrorMessage(res.status, json));
  }
  if (!json?.success) {
    throw new Error(json?.error?.message ?? "Unknown error");
  }
  return json.data;
}

// ── Component ────────────────────────────────────────────────────

export default function ProfitLossClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const { setReportData, setReportStatus } = useReportContext();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["profit-loss", from, to],
    queryFn: () => fetchPL(from, to),
  });

  // Push data to ReportContext for export. ARGUS #441: one builder carries the
  // visible statement rows (margins, COGS split), the monthly table and totals.
  useEffect(() => {
    if (!data) return;
    setReportData(buildProfitLossExportRows(data));
  }, [data, setReportData]);

  // ARGUS #442: hide the layout's Export/Save controls while the report failed.
  useEffect(() => {
    if (error) setReportStatus("error");
    else if (isLoading) setReportStatus("loading");
  }, [error, isLoading, setReportStatus]);

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <p className="text-red-600">Failed to load report: {error.message}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const isPositiveGross = parseFloat(data.grossProfit) >= 0;
  const isPositiveNet = parseFloat(data.netProfit) >= 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Net Revenue" value={fmtCurrency(data.netRevenue)} />
        <StatCard
          label="Gross Profit"
          value={fmtCurrency(data.grossProfit)}
          positive={isPositiveGross}
        />
        <StatCard
          label="Net Profit"
          value={fmtCurrency(data.netProfit)}
          positive={isPositiveNet}
        />
        <StatCard label="Gross Margin" value={`${data.grossMargin}%`} />
        <StatCard label="Net Margin" value={`${data.netMargin}%`} />
      </div>

      {data.cogsQuality.usesFallback && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">COGS includes current-cost fallback</p>
          {data.cogsQuality.caveats.map((caveat) => (
            <p key={caveat} className="mt-1">
              {caveat}
            </p>
          ))}
        </div>
      )}

      {/* ── P&L Statement Table ───────────────────────────── */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist bg-mist/40">
                <th className="px-4 py-2.5 text-left font-semibold text-espresso">
                  Item
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-espresso">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue section */}
              <SectionHeader label="Revenue" />
              {data.revenueByPaymentMethod.map((r) => (
                <Row key={r.method} label={paymentMethodLabel(r.method)} amount={r.total} />
              ))}
              <Row
                label="Less: Returns"
                amount={`-${data.totalReturns}`}
                negative
              />
              <TotalRow label="Net Revenue" amount={data.netRevenue} />

              {/* COGS section */}
              <SectionHeader label="Cost of Goods Sold" />
              {data.cogsQuality.sales.usesFallback && (
                <>
                  <Row
                    label="COGS - snapshot cost"
                    amount={data.cogsQuality.sales.snapshotCogs.toFixed(2)}
                  />
                  <Row
                    label={`COGS - current-cost fallback (${data.cogsQuality.sales.fallbackLines} lines)`}
                    amount={data.cogsQuality.sales.fallbackCogs.toFixed(2)}
                  />
                </>
              )}
              <Row label="COGS (Sales)" amount={data.rawCOGS} />
              {data.cogsQuality.returned.usesFallback && (
                <>
                  <Row
                    label="Returned COGS - snapshot cost"
                    amount={`-${data.cogsQuality.returned.snapshotCogs.toFixed(2)}`}
                    negative
                  />
                  <Row
                    label={`Returned COGS - current-cost fallback (${data.cogsQuality.returned.fallbackLines} lines)`}
                    amount={`-${data.cogsQuality.returned.fallbackCogs.toFixed(2)}`}
                    negative
                  />
                </>
              )}
              <Row
                label="Less: Returned COGS"
                amount={`-${data.returnedCOGS}`}
                negative
              />
              <TotalRow label="Net COGS" amount={data.netCOGS} />

              {/* Gross Profit */}
              <ProfitRow
                label="Gross Profit"
                amount={data.grossProfit}
                positive={isPositiveGross}
                extra={`${data.grossMargin}% margin`}
              />

              {/* Expenses section */}
              <SectionHeader label="Operating Expenses" />
              {data.expenseCategories.map((e) => (
                <Row
                  key={e.category}
                  label={expenseCategoryLabel(e.category)}
                  amount={e.total}
                />
              ))}
              <TotalRow
                label="Total Expenses"
                amount={data.totalExpenses}
              />

              {/* Net Profit */}
              <ProfitRow
                label="Net Profit"
                amount={data.netProfit}
                positive={isPositiveNet}
                extra={`${data.netMargin}% margin`}
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── Monthly Trend ─────────────────────────────────── */}
      {data.monthlyData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-espresso">
              Monthly Gross Profit (Selected Period)
            </h3>
            <MonthlyChart months={data.monthlyData} />

            {/* Monthly detail table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-mist">
                    <th className="px-2 py-1.5 text-left text-espresso/70">
                      Month
                    </th>
                    <th className="px-2 py-1.5 text-right text-espresso/70">
                      Revenue
                    </th>
                    <th className="px-2 py-1.5 text-right text-espresso/70">
                      COGS
                    </th>
                    <th className="px-2 py-1.5 text-right text-espresso/70">
                      Gross Profit
                    </th>
                    <th className="px-2 py-1.5 text-right text-espresso/70">
                      Expenses
                    </th>
                    <th className="px-2 py-1.5 text-right text-espresso/70">
                      Net Profit
                    </th>
                    <th className="px-2 py-1.5 text-right text-espresso/70">
                      Sales
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyData.map((m, i) => (
                    <tr
                      key={m.month}
                      className={i % 2 === 0 ? "bg-pearl/50" : ""}
                    >
                      <td className="px-2 py-1.5 text-espresso">
                        {reportMonthLabel(m.month)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-espresso">
                        {fmtCurrency(m.revenue)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-espresso">
                        {fmtCurrency(m.cogs)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono ${parseFloat(m.grossProfit) >= 0 ? "text-green-700" : "text-red-600"}`}
                      >
                        {fmtCurrency(m.grossProfit)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-espresso">
                        {fmtCurrency(m.expenses)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono ${parseFloat(m.netProfit) >= 0 ? "text-green-700" : "text-red-600"}`}
                      >
                        {fmtCurrency(m.netProfit)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-espresso">
                        {m.saleCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  const color =
    positive === undefined
      ? "text-espresso"
      : positive
        ? "text-green-700"
        : "text-red-600";

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-espresso/60">{label}</p>
        <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-mist/30">
      <td
        colSpan={2}
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-espresso/70"
      >
        {label}
      </td>
    </tr>
  );
}

function Row({
  label,
  amount,
  negative,
}: {
  label: string;
  amount: string;
  negative?: boolean;
}) {
  return (
    <tr className="border-b border-mist/30 odd:bg-pearl/30">
      <td className="px-4 py-2 text-espresso">{label}</td>
      <td
        className={`px-4 py-2 text-right font-mono ${negative ? "text-red-600" : "text-espresso"}`}
      >
        {fmtCurrency(amount)}
      </td>
    </tr>
  );
}

function TotalRow({ label, amount }: { label: string; amount: string }) {
  return (
    <tr className="border-b border-mist bg-pearl/50">
      <td className="px-4 py-2 font-semibold text-espresso">{label}</td>
      <td className="px-4 py-2 text-right font-mono font-semibold text-espresso">
        {fmtCurrency(amount)}
      </td>
    </tr>
  );
}

function ProfitRow({
  label,
  amount,
  positive,
  extra,
}: {
  label: string;
  amount: string;
  positive: boolean;
  extra: string;
}) {
  return (
    <tr className="border-b-2 border-mist bg-pearl/60">
      <td className="px-4 py-2.5 font-bold text-espresso">
        {label}{" "}
        <span className="ml-2 text-xs font-normal text-espresso/50">
          {extra}
        </span>
      </td>
      <td
        className={`px-4 py-2.5 text-right font-mono text-base font-bold ${positive ? "text-green-700" : "text-red-600"}`}
      >
        {fmtCurrency(amount)}
      </td>
    </tr>
  );
}

function MonthlyChart({ months }: { months: MonthlyRow[] }) {
  const values = months.map((m) => parseFloat(m.grossProfit));
  const maxAbs = useMemo(
    () => Math.max(...values.map(Math.abs), 1),
    [values],
  );

  // ARGUS #440: signed bars share one zero baseline. A negative month used to
  // grow upwards from the same floor as positive bars and read as a gain.
  return (
    <div>
      <div className="flex items-stretch gap-1.5" style={{ height: 160 }}>
        {months.map((m) => {
          const val = parseFloat(m.grossProfit);
          const isPositive = val >= 0;
          const heightPx = Math.max((Math.abs(val) / maxAbs) * 70, 2);

          return (
            <div key={m.month} className="flex flex-1 flex-col" style={{ height: 160 }}>
              <div className="flex flex-1 items-end justify-center">
                {isPositive && (
                  <div
                    className="w-full max-w-10 rounded-t bg-green-500/70"
                    style={{ height: heightPx }}
                    title={`${reportMonthLabel(m.month)}: ${fmtCurrency(m.grossProfit)}`}
                  />
                )}
              </div>
              <div className="h-px w-full bg-mist" aria-hidden="true" />
              <div className="flex flex-1 items-start justify-center">
                {!isPositive && (
                  <div
                    className="w-full max-w-10 rounded-b bg-red-400/70"
                    style={{ height: heightPx }}
                    title={`${reportMonthLabel(m.month)}: ${fmtCurrency(m.grossProfit)}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {months.map((m) => (
          <span
            key={m.month}
            className="flex-1 text-center text-[10px] text-espresso/60"
          >
            {reportMonthLabel(m.month)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-espresso/50">
        Bars share a zero line: positive gross profit sits above it, negative
        below.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
      <Skeleton className="h-60 rounded-xl" />
    </div>
  );
}
