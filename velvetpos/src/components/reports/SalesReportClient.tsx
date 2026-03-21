"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// ── Types ────────────────────────────────────────────────────────

interface ProductRow {
  variantId: string;
  productName: string;
  variantDescription: string;
  unitsSold: number;
  grossRevenue: string;
  returns: string;
  netRevenue: string;
  pctOfTotal: string;
}

interface SalesTotals {
  totalUnits: number;
  grossRevenue: string;
  totalReturns: string;
  netRevenue: string;
}

interface SalesData {
  products: ProductRow[];
  totals: SalesTotals;
}

interface SalesResponse {
  success: boolean;
  data: SalesData;
  error?: { code: string; message: string };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchSales(from: string, to: string): Promise<SalesData> {
  const res = await fetch(
    `/api/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: SalesResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Sort Logic ───────────────────────────────────────────────────

type SortKey = "unitsSold" | "grossRevenue" | "netRevenue";
type SortDir = "asc" | "desc";

function sortProducts(
  products: ProductRow[],
  key: SortKey,
  dir: SortDir,
): ProductRow[] {
  return [...products].sort((a, b) => {
    const av = key === "unitsSold" ? a.unitsSold : parseFloat(a[key]);
    const bv = key === "unitsSold" ? b.unitsSold : parseFloat(b[key]);
    return dir === "asc" ? av - bv : bv - av;
  });
}

// ── Component ────────────────────────────────────────────────────

export default function SalesReportClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const { setReportData } = useReportContext();

  const [sortKey, setSortKey] = useState<SortKey>("netRevenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-report", from, to],
    queryFn: () => fetchSales(from, to),
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return sortProducts(data.products, sortKey, sortDir);
  }, [data, sortKey, sortDir]);

  const top10 = useMemo(() => sorted.slice(0, 10), [sorted]);
  const maxBar = useMemo(() => {
    if (top10.length === 0) return 1;
    return Math.max(...top10.map((p) => parseFloat(p.netRevenue)), 1);
  }, [top10]);

  // Push data to ReportContext for export
  useEffect(() => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.products.map((p) => ({
      Product: p.productName,
      Variant: p.variantDescription,
      "Units Sold": p.unitsSold,
      "Gross Revenue": p.grossRevenue,
      Returns: p.returns,
      "Net Revenue": p.netRevenue,
      "% of Total": p.pctOfTotal,
    }));
    setReportData(rows);
  }, [data, setReportData]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Units Sold" value={String(data.totals.totalUnits)} />
        <StatCard
          label="Gross Revenue"
          value={fmtCurrency(data.totals.grossRevenue)}
        />
        <StatCard
          label="Returns"
          value={fmtCurrency(data.totals.totalReturns)}
          negative
        />
        <StatCard
          label="Net Revenue"
          value={fmtCurrency(data.totals.netRevenue)}
        />
      </div>

      {/* ── Top 10 Bar Chart ──────────────────────────────── */}
      {top10.length > 0 && (
        <Card>
          <CardHeader className="bg-mist rounded-t-lg">
            <CardTitle className="text-espresso text-base">
              Top 10 Products by Net Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {top10.map((item) => (
                <div key={item.variantId} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm text-espresso">
                    {item.productName}
                  </span>
                  <div className="flex-1 bg-pearl rounded-full h-6">
                    <div
                      className="h-6 rounded-full"
                      style={{
                        width: `${(parseFloat(item.netRevenue) / maxBar) * 100}%`,
                        backgroundColor: "#A48374",
                      }}
                    />
                  </div>
                  <span className="w-28 text-right font-mono text-sm">
                    {fmtCurrency(item.netRevenue)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Data Table ────────────────────────────────────── */}
      <Card>
        <CardHeader className="bg-mist rounded-t-lg">
          <CardTitle className="text-espresso text-base">
            Sales by Product
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No sales data for this date range.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("unitsSold")}
                  >
                    Units Sold{sortIndicator("unitsSold")}
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("grossRevenue")}
                  >
                    Gross Revenue{sortIndicator("grossRevenue")}
                  </TableHead>
                  <TableHead className="text-right">Returns</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("netRevenue")}
                  >
                    Net Revenue{sortIndicator("netRevenue")}
                  </TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => (
                  <TableRow key={p.variantId}>
                    <TableCell className="font-medium">
                      {p.productName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.variantDescription}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {p.unitsSold}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(p.grossRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {parseFloat(p.returns) > 0
                        ? `-${fmtCurrency(p.returns)}`
                        : fmtCurrency(p.returns)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(p.netRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {p.pctOfTotal}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Grand Total</TableCell>
                  <TableCell className="text-right font-mono">
                    {data.totals.totalUnits}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(data.totals.grossRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {parseFloat(data.totals.totalReturns) > 0
                      ? `-${fmtCurrency(data.totals.totalReturns)}`
                      : fmtCurrency(data.totals.totalReturns)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(data.totals.netRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-mono">100%</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-lg font-semibold font-mono ${negative ? "text-red-600" : "text-espresso"}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
