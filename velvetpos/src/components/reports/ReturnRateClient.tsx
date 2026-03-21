"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportContext } from "@/lib/reports/ReportContext";

// ── Helpers ──────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toYMD(d);
}

function defaultTo(): string {
  return toYMD(new Date());
}

function fmtCurrency(val: string | number): string {
  const num = typeof val === "number" ? val : parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(num);
}

// ── Types ────────────────────────────────────────────────────────

interface OverallStats {
  totalRevenue: string;
  totalRefunds: string;
  totalReturns: number;
  returnRate: string;
}

interface CategoryRow {
  categoryId: string;
  categoryName: string;
  totalSales: string;
  totalRefunds: string;
  returnRate: string;
}

interface ReasonRow {
  reason: string;
  count: number;
  refundAmount: string;
}

interface TopReturnedRow {
  rank: number;
  productName: string;
  unitsReturned: number;
  returnValue: string;
}

interface ReturnRateData {
  overall: OverallStats;
  categories: CategoryRow[];
  reasons: ReasonRow[];
  topReturned: TopReturnedRow[];
}

interface ApiResponse {
  success: boolean;
  data: ReturnRateData;
  error?: { code: string; message: string };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchReturnRate(
  from: string,
  to: string,
): Promise<ReturnRateData> {
  const res = await fetch(
    `/api/reports/return-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: ApiResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Donut Chart Colors ───────────────────────────────────────────

const DONUT_COLORS = [
  "#A48374",
  "#CBAD8D",
  "#D1C7BD",
  "#3A2D28",
  "#EBE3DB",
  "#F1EDE6",
];

// ── Component ────────────────────────────────────────────────────

export default function ReturnRateClient() {
  const searchParams = useSearchParams();
  const { setReportData } = useReportContext();

  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();

  const { data, isLoading, error } = useQuery({
    queryKey: ["return-rate", from, to],
    queryFn: () => fetchReturnRate(from, to),
  });

  useEffect(() => {
    if (data?.categories) {
      setReportData(
        data.categories.map((c) => ({
          category: c.categoryName,
          totalSales: c.totalSales,
          totalRefunds: c.totalRefunds,
          returnRate: c.returnRate,
        })),
      );
    }
  }, [data, setReportData]);

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Error: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const overall = data?.overall;
  const categories = data?.categories ?? [];
  const reasons = data?.reasons ?? [];
  const topReturned = data?.topReturned ?? [];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold" style={{ color: "#3A2D28" }}>
        Return Rate Report
      </h1>

      {/* ── Stat Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Overall Return Rate"
          value={isLoading ? null : `${overall?.returnRate ?? "0.00"}%`}
        />
        <StatCard
          title="Total Returns"
          value={isLoading ? null : String(overall?.totalReturns ?? 0)}
        />
        <StatCard
          title="Total Refund Value"
          value={
            isLoading ? null : fmtCurrency(overall?.totalRefunds ?? "0.00")
          }
        />
      </div>

      {/* ── Category Table ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Return Rate by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No category data for this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">
                    Total Sales Revenue
                  </TableHead>
                  <TableHead className="text-right">
                    Total Returns Value
                  </TableHead>
                  <TableHead className="text-right">Return Rate %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => {
                  const rate = parseFloat(cat.returnRate);
                  return (
                    <TableRow key={cat.categoryId}>
                      <TableCell className="font-medium">
                        {cat.categoryName}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtCurrency(cat.totalSales)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {fmtCurrency(cat.totalRefunds)}
                      </TableCell>
                      <TableCell className="text-right">
                        <RateBadge rate={rate} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Return Reasons ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Return Reasons</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="mx-auto h-48 w-48 rounded-full" />
          ) : reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No returns in this period.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
              <DonutChart reasons={reasons} />
              <ReasonsList reasons={reasons} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top 10 Most-Returned Products ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Most-Returned Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : topReturned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No returned products in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Units Returned</TableHead>
                  <TableHead className="text-right">Return Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topReturned.map((row) => (
                  <TableRow key={row.rank}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell className="font-medium">
                      {row.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.unitsReturned}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtCurrency(row.returnValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold" style={{ color: "#3A2D28" }}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RateBadge({ rate }: { rate: number }) {
  if (rate > 7) {
    return (
      <Badge variant="destructive" className="font-bold">
        {rate.toFixed(2)}%
      </Badge>
    );
  }
  if (rate >= 3) {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-600">
        {rate.toFixed(2)}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-600 text-white hover:bg-green-700">
      {rate.toFixed(2)}%
    </Badge>
  );
}

function DonutChart({ reasons }: { reasons: ReasonRow[] }) {
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return null;

  let cumPct = 0;
  const gradientParts = reasons.map((r, i) => {
    const start = cumPct;
    cumPct += (r.count / total) * 100;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${cumPct}%`;
  });

  return (
    <div className="relative mx-auto h-48 w-48">
      <div
        className="h-48 w-48 rounded-full"
        style={{
          background: `conic-gradient(${gradientParts.join(", ")})`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-muted-foreground">Returns</span>
        </div>
      </div>
    </div>
  );
}

function ReasonsList({ reasons }: { reasons: ReasonRow[] }) {
  return (
    <div className="space-y-2">
      {reasons.map((r, i) => (
        <div key={r.reason} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{
              backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
            }}
          />
          <span className="font-medium">{r.reason}</span>
          <span className="text-muted-foreground">
            ({r.count}) · {fmtCurrency(r.refundAmount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
