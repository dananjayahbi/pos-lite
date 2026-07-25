"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function fmtCurrency(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(num);
}

function fmtDate(iso: string, granularity: string): string {
  const d = new Date(iso);
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  }
  if (granularity === "weekly") {
    return `Wk ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// ── Types ────────────────────────────────────────────────────────

interface TimeSeriesPoint {
  date: string;
  revenue: string;
  returns: string;
  transactions: number;
}

interface PeakHourPoint {
  hour: number;
  revenue: string;
  count: number;
}

interface Stats {
  totalRevenue: string;
  totalTransactions: number;
  avgOrderValue: string;
  returnRate: string;
}

interface RevenueTrendData {
  timeSeries: TimeSeriesPoint[];
  peakHours: PeakHourPoint[];
  stats: Stats;
}

interface ApiResponse {
  success: boolean;
  data: RevenueTrendData;
  error?: { code: string; message: string };
}

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// ── Fetch ────────────────────────────────────────────────────────

async function fetchRevenueTrend(
  from: string,
  to: string,
  granularity: Granularity,
): Promise<RevenueTrendData> {
  const params = new URLSearchParams({ from, to, granularity });
  const res = await fetch(`/api/reports/revenue-trend?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch revenue trend");
  const json: ApiResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Stat Card ────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-mist">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className="text-2xl font-bold text-espresso">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── SVG Line Chart ───────────────────────────────────────────────

function LineChart({
  data,
  granularity,
}: {
  data: TimeSeriesPoint[];
  granularity: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-mist">
        No data for selected range
      </div>
    );
  }

  const revenues = data.map((d) => parseFloat(d.revenue));
  const returns = data.map((d) => parseFloat(d.returns));
  const maxVal = Math.max(...revenues, ...returns, 1);

  const pad = 8;
  const w = 100;
  const h = 100;
  const plotW = w - pad * 2;
  const plotH = h - pad * 2;

  function toPoints(values: number[]): string {
    return values
      .map((v, i) => {
        const x =
          data.length === 1
            ? pad + plotW / 2
            : pad + (i / (data.length - 1)) * plotW;
        const y = pad + plotH - (v / maxVal) * plotH;
        return `${x},${y}`;
      })
      .join(" ");
  }

  const revenuePoints = toPoints(revenues);
  const returnPoints = toPoints(returns);

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
      >
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = pad + plotH - pct * plotH;
          return (
            <line
              key={pct}
              x1={pad}
              y1={y}
              x2={w - pad}
              y2={y}
              stroke="#D1C7BD"
              strokeWidth="0.15"
            />
          );
        })}
        {/* revenue line */}
        <polyline
          points={revenuePoints}
          fill="none"
          stroke="#A48374"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {/* returns line */}
        <polyline
          points={returnPoints}
          fill="none"
          stroke="#3A2D28"
          strokeWidth="0.4"
          strokeDasharray="1,1"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-mist">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-terracotta" /> Revenue
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-espresso" />{" "}
          Returns
        </span>
      </div>
      {/* x-axis labels */}
      <div className="mt-1 flex justify-between text-[10px] text-mist">
        {data.length <= 12
          ? data.map((d) => (
              <span key={d.date}>{fmtDate(d.date, granularity)}</span>
            ))
          : [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].map(
              (d) =>
                d ? (
                  <span key={d.date}>{fmtDate(d.date, granularity)}</span>
                ) : null,
            )}
      </div>
    </div>
  );
}

// ── Peak Hours Bar Chart ─────────────────────────────────────────

function PeakHoursChart({ data }: { data: PeakHourPoint[] }) {
  const maxRevenue = Math.max(...data.map((d) => parseFloat(d.revenue)), 1);

  return (
    <div className="flex h-32 items-end gap-[2px]">
      {data.map((d) => {
        const pct = parseFloat(d.revenue) / maxRevenue;
        return (
          <div
            key={d.hour}
            className="group relative flex flex-1 flex-col items-center"
          >
            <div
              className="w-full rounded-t-sm bg-terracotta transition-opacity"
              style={{
                height: `${Math.max(pct * 100, 2)}%`,
                opacity: Math.max(pct, 0.15),
              }}
              title={`${fmtHour(d.hour)}: ${fmtCurrency(d.revenue)} (${d.count} sales)`}
            />
            <span className="mt-1 text-[8px] text-mist">
              {d.hour % 3 === 0 ? fmtHour(d.hour) : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function RevenueTrendClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setReportData } = useReportContext();

  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const granularity = (searchParams.get("granularity") ?? "daily") as Granularity;

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-trend", from, to, granularity],
    queryFn: () => fetchRevenueTrend(from, to, granularity),
  });

  const reportRows = useMemo(() => {
    if (!data) return [];
    return data.timeSeries.map((row) => ({
      date: row.date,
      revenue: row.revenue,
      returns: row.returns,
      transactions: row.transactions,
    }));
  }, [data]);

  useEffect(() => {
    setReportData(reportRows);
  }, [reportRows, setReportData]);

  function setGranularity(g: Granularity) {
    const params = new URLSearchParams({ from, to, granularity: g });
    router.push(`/reports/revenue-trend?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Header + granularity toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-espresso">Revenue Trend</h1>
        <div className="flex gap-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="outline"
              size="sm"
              className={
                granularity === opt.value
                  ? "bg-espresso text-white hover:bg-espresso/90"
                  : ""
              }
              onClick={() => setGranularity(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={data ? fmtCurrency(data.stats.totalRevenue) : "—"}
          loading={isLoading}
        />
        <StatCard
          title="Total Transactions"
          value={data ? data.stats.totalTransactions.toLocaleString() : "—"}
          loading={isLoading}
        />
        <StatCard
          title="Avg Order Value"
          value={data ? fmtCurrency(data.stats.avgOrderValue) : "—"}
          loading={isLoading}
        />
        <StatCard
          title="Return Rate"
          value={data ? `${data.stats.returnRate}%` : "—"}
          loading={isLoading}
        />
      </div>

      {/* Revenue trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-mist">
            Revenue &amp; Returns Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <LineChart
              data={data?.timeSeries ?? []}
              granularity={granularity}
            />
          )}
        </CardContent>
      </Card>

      {/* Peak hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-mist">
            Peak Sales Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <PeakHoursChart data={data?.peakHours ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
