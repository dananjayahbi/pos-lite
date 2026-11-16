"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportContext } from "@/lib/reports/ReportContext";
import {
  buildRevenueSeries,
  pickAxisTicks,
  type RevenueSeriesPoint,
} from "@/lib/reports/revenue-trend";

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

const compactCurrency = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Axis tick label for a UTC bucket timestamp. */
function fmtAxisDate(timestamp: number, granularity: string): string {
  const d = new Date(timestamp);
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Full label for the tooltip header. */
function fmtTooltipDate(timestamp: number, granularity: string): string {
  const d = new Date(timestamp);
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  }
  const day = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return granularity === "weekly" ? `Week of ${day}` : day;
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
        <CardTitle className="text-sm font-medium text-mist-ink">{title}</CardTitle>
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

// ── Revenue & Returns Chart ──────────────────────────────────────

function RevenueTrendChart({
  data,
  granularity,
}: {
  data: RevenueSeriesPoint[];
  granularity: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-mist-ink">
        No data for selected range
      </div>
    );
  }

  // A single bucket still needs a visible marker and a non-degenerate domain.
  const domain: [number, number] =
    data.length === 1
      ? [data[0]!.timestamp - 12 * 60 * 60 * 1000, data[0]!.timestamp + 12 * 60 * 60 * 1000]
      : [data[0]!.timestamp, data[data.length - 1]!.timestamp];
  // Daily ranges stay readable without marking every point.
  const showDots = data.length <= 31;

  return (
    <div data-testid="revenue-trend-chart" className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <RechartsLineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D1C7BD" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={domain}
            ticks={pickAxisTicks(data, 6)}
            tickFormatter={(value) => fmtAxisDate(Number(value), granularity)}
            tick={{ fontSize: 11, fill: "#7B6E64" }}
            tickLine={false}
            axisLine={{ stroke: "#D1C7BD" }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#7B6E64" }}
            tickLine={false}
            axisLine={false}
            width={64}
            allowDecimals={false}
            tickFormatter={(value) => `Rs. ${compactCurrency.format(Number(value))}`}
          />
          <Tooltip
            cursor={{ stroke: "#CBAD8D", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #D1C7BD",
              fontSize: 12,
              boxShadow: "0 6px 16px rgba(58, 45, 40, 0.12)",
            }}
            labelStyle={{ color: "#3A2D28", fontWeight: 600, marginBottom: 4 }}
            labelFormatter={(value) => fmtTooltipDate(Number(value), granularity)}
            formatter={(value, name) => [
              fmtCurrency(Number(value)),
              name === "revenue" ? "Revenue" : "Returns",
            ]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke="#A48374"
            strokeWidth={2}
            dot={showDots ? { r: 2.5, fill: "#A48374", strokeWidth: 0 } : false}
            activeDot={{ r: 4, fill: "#A48374", strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="returns"
            name="returns"
            stroke="#3A2D28"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={showDots ? { r: 2, fill: "#3A2D28", strokeWidth: 0 } : false}
            activeDot={{ r: 4, fill: "#3A2D28", strokeWidth: 0 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-mist-ink">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-terracotta" /> Revenue
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-espresso" />{" "}
          Returns
        </span>
      </div>
    </div>
  );
}

// ── Peak Hours Bar Chart ─────────────────────────────────────────

function PeakHoursChart({ data }: { data: PeakHourPoint[] }) {
  const maxRevenue = Math.max(...data.map((d) => parseFloat(d.revenue)), 1);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const hasRevenue = data.some((d) => parseFloat(d.revenue) > 0);
  // Fixed pixel bar area: percentage heights inside an auto-height flex column
  // resolved to 0, so every bar was invisible (ISSUE 9). When revenue is zero
  // but transactions exist, fall back to transaction counts.
  const BAR_AREA_PX = 112;
  const max = hasRevenue ? maxRevenue : maxCount;

  return (
    <div className="flex items-end gap-[2px]">
      {data.map((d) => {
        const value = hasRevenue ? parseFloat(d.revenue) : d.count;
        const pct = max > 0 ? value / max : 0;
        return (
          <div
            key={d.hour}
            className="group relative flex flex-1 flex-col items-center"
          >
            <div
              className="flex w-full items-end"
              style={{ height: `${BAR_AREA_PX}px` }}
            >
              <div
                className="w-full rounded-t-sm bg-terracotta transition-opacity"
                style={{
                  height: `${Math.max(pct * BAR_AREA_PX, 2)}px`,
                  opacity: Math.max(pct, 0.15),
                }}
                title={`${fmtHour(d.hour)}: ${fmtCurrency(d.revenue)} (${d.count} sales)`}
              />
            </div>
            <span className="mt-1 text-[8px] text-mist-ink">
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

  // Fill every bucket in the selected range so the line follows the calendar
  // instead of connecting only the days that happened to have sales.
  const series = useMemo(
    () => buildRevenueSeries(data?.timeSeries ?? [], from, to, granularity),
    [data, from, to, granularity],
  );

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
          value={data ? fmtCurrency(data.stats.totalRevenue) : "-"}
          loading={isLoading}
        />
        <StatCard
          title="Total Transactions"
          value={data ? data.stats.totalTransactions.toLocaleString() : "-"}
          loading={isLoading}
        />
        <StatCard
          title="Avg Order Value"
          value={data ? fmtCurrency(data.stats.avgOrderValue) : "-"}
          loading={isLoading}
        />
        <StatCard
          title="Return Rate"
          value={data ? `${data.stats.returnRate}%` : "-"}
          loading={isLoading}
        />
      </div>

      {/* Revenue trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-mist-ink">
            Revenue &amp; Returns Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <RevenueTrendChart data={series} granularity={granularity} />
          )}
        </CardContent>
      </Card>

      {/* Peak hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-mist-ink">
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
