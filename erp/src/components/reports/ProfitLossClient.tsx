"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportContext } from "@/lib/reports/ReportContext";

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
  const num = parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(num);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
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
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: PLResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Component ────────────────────────────────────────────────────

export default function ProfitLossClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const { setReportData } = useReportContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ["profit-loss", from, to],
    queryFn: () => fetchPL(from, to),
  });

  // Push data to ReportContext for export
  useEffect(() => {
    if (!data) return;

    const rows: Record<string, unknown>[] = [];

    // Revenue section
    for (const r of data.revenueByPaymentMethod) {
      rows.push({ Section: "Revenue", Item: r.method, Amount: r.total });
    }
    rows.push({
      Section: "Revenue",
      Item: "Less: Returns",
      Amount: `-${data.totalReturns}`,
    });
    rows.push({
      Section: "Revenue",
      Item: "Net Revenue",
      Amount: data.netRevenue,
    });

    // COGS
    rows.push({ Section: "COGS", Item: "Cost of Goods Sold", Amount: data.rawCOGS });
    rows.push({
      Section: "COGS",
      Item: "Less: Returned COGS",
      Amount: `-${data.returnedCOGS}`,
    });
    rows.push({ Section: "COGS", Item: "Net COGS", Amount: data.netCOGS });

    // Gross Profit
    rows.push({
      Section: "Profit",
      Item: "Gross Profit",
      Amount: data.grossProfit,
    });

    // Expenses
    for (const e of data.expenseCategories) {
      rows.push({ Section: "Expenses", Item: e.category, Amount: e.total });
    }
    rows.push({
      Section: "Expenses",
      Item: "Total Expenses",
      Amount: data.totalExpenses,
    });

    // Net Profit
    rows.push({
      Section: "Profit",
      Item: "Net Profit",
      Amount: data.netProfit,
    });

    setReportData(rows);
  }, [data, setReportData]);

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load report: {error.message}
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
                <Row key={r.method} label={r.method} amount={r.total} />
              ))}
              <Row
                label="Less: Returns"
                amount={`-${data.totalReturns}`}
                negative
              />
              <TotalRow label="Net Revenue" amount={data.netRevenue} />

              {/* COGS section */}
              <SectionHeader label="Cost of Goods Sold" />
              <Row label="COGS (Sales)" amount={data.rawCOGS} />
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
                  label={e.category.replace(/_/g, " ")}
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
              Monthly Gross Profit (Last 12 Months)
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
                        {monthLabel(m.month)}
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

  return (
    <div className="flex items-end gap-1.5" style={{ height: 160 }}>
      {months.map((m) => {
        const val = parseFloat(m.grossProfit);
        const pct = Math.abs(val) / maxAbs;
        const heightPx = Math.max(pct * 140, 4);
        const isPositive = val >= 0;

        return (
          <div
            key={m.month}
            className="flex flex-1 flex-col items-center justify-end"
            style={{ height: 160 }}
          >
            <div
              className={`w-full max-w-10 rounded-t ${isPositive ? "bg-green-500/70" : "bg-red-400/70"}`}
              style={{ height: heightPx }}
              title={`${monthLabel(m.month)}: ${fmtCurrency(m.grossProfit)}`}
            />
            <span className="mt-1 text-[10px] text-espresso/60">
              {monthLabel(m.month)}
            </span>
          </div>
        );
      })}
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
