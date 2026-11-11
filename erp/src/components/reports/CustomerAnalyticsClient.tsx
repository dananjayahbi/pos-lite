"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  REPEAT_BADGE_META,
  type RepeatBadgeTier,
} from "@/lib/services/customer-loyalty";

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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function maskPhone(phone: string, role: string): string {
  if (role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN") {
    return phone;
  }
  if (phone.length <= 4) return phone;
  return "•••• " + phone.slice(-4);
}

// ── Types ────────────────────────────────────────────────────────

interface TopCustomer {
  rank: number;
  customerId: string;
  name: string;
  phone: string;
  totalOrders: number;
  lifetimeOrders: number;
  repeatBadge: "GOLD" | "SILVER" | "BRONZE" | null;
  totalSpend: string;
  aov: string;
  lastVisit: string | null;
}

interface WeekBucket {
  week: string;
  label: string;
  newCount: number;
  returningCount: number;
}

interface ChurnRiskCustomer {
  id: string;
  name: string;
  phone: string;
  lastPurchaseDate: string;
  daysSince: number;
  lifetimeSpend: string;
}

interface CustomerAnalyticsData {
  topCustomers: TopCustomer[];
  newVsReturning: WeekBucket[];
  churnRisk: ChurnRiskCustomer[];
  userRole: string;
}

interface ApiResponse {
  success: boolean;
  data: CustomerAnalyticsData;
  error?: { code: string; message: string };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchCustomerAnalytics(
  from: string,
  to: string,
): Promise<CustomerAnalyticsData> {
  const res = await fetch(
    `/api/reports/customer-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: ApiResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Component ────────────────────────────────────────────────────

export default function CustomerAnalyticsClient() {
  const searchParams = useSearchParams();
  const { setReportData } = useReportContext();

  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-analytics", from, to],
    queryFn: () => fetchCustomerAnalytics(from, to),
  });

  useEffect(() => {
    if (data?.topCustomers) {
      setReportData(
        data.topCustomers.map((c) => ({
          rank: c.rank,
          name: c.name,
          phone: c.phone,
          totalOrders: c.totalOrders,
          totalSpend: c.totalSpend,
          aov: c.aov,
          lastVisit: c.lastVisit ?? "",
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

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold" style={{ color: "#3A2D28" }}>
        Customer Analytics
      </h1>

      {/* ── Section 1: Top Customers ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : (
            <TopCustomersTable
              customers={data?.topCustomers ?? []}
              userRole={data?.userRole ?? "CASHIER"}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: New vs Returning ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>New vs Returning Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <NewVsReturningChart weeks={data?.newVsReturning ?? []} />
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Churn Risk ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Churn Risk</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <ChurnRiskTable
              customers={data?.churnRisk ?? []}
              userRole={data?.userRole ?? "CASHIER"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Top Customers Table ──────────────────────────────────────────

function TopCustomersTable({
  customers,
  userRole,
}: {
  customers: TopCustomer[];
  userRole: string;
}) {
  if (customers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No customer data for this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Total Spend</TableHead>
            <TableHead className="text-right">AOV</TableHead>
            <TableHead>Last Visit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.customerId}>
              <TableCell className="font-medium">{c.rank}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  {c.name}
                  {c.repeatBadge ? (
                    <RepeatBadge tier={c.repeatBadge} orderCount={c.lifetimeOrders} />
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {maskPhone(c.phone, userRole)}
              </TableCell>
              <TableCell className="text-right">{c.totalOrders}</TableCell>
              <TableCell className="text-right">
                {fmtCurrency(c.totalSpend)}
              </TableCell>
              <TableCell className="text-right">
                {fmtCurrency(c.aov)}
              </TableCell>
              <TableCell>
                {c.lastVisit ? fmtDate(c.lastVisit) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Repeat-buyer metal badge (ISSUE 8) ───────────────────────────

const REPEAT_BADGE_STYLES: Record<RepeatBadgeTier, string> = {
  GOLD: "border-yellow-300 bg-yellow-100 text-yellow-800",
  SILVER: "border-slate-300 bg-slate-100 text-slate-700",
  BRONZE: "border-amber-300 bg-amber-100 text-amber-800",
};

function RepeatBadge({
  tier,
  orderCount,
}: {
  tier: RepeatBadgeTier;
  orderCount: number;
}) {
  const meta = REPEAT_BADGE_META[tier];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${REPEAT_BADGE_STYLES[tier]}`}
      title={`${meta.label} repeat customer · ${orderCount} lifetime orders`}
    >
      {meta.label}
    </span>
  );
}

// ── New vs Returning CSS Stacked Bar Chart ───────────────────────

function NewVsReturningChart({ weeks }: { weeks: WeekBucket[] }) {
  if (weeks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No data for this period.
      </p>
    );
  }

  const maxTotal = Math.max(
    ...weeks.map((w) => w.newCount + w.returningCount),
    1,
  );
  // Fixed pixel scale instead of percentage heights: the bar's parent is an
  // auto-height flex item, so `height: %` resolved to 0 and the chart rendered
  // blank even when the API returned data (ISSUE 8).
  const BAR_AREA_PX = 160;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-3">
          {weeks.map((w) => {
            const total = w.newCount + w.returningCount;
            const newHeight = (w.newCount / maxTotal) * BAR_AREA_PX;
            const returningHeight = (w.returningCount / maxTotal) * BAR_AREA_PX;
            return (
              <div
                key={w.week}
                className="flex w-14 shrink-0 flex-col items-center gap-1"
              >
                <div
                  className="flex w-full flex-col justify-end"
                  style={{ height: `${BAR_AREA_PX}px` }}
                  title={`${w.label}: ${w.newCount} new · ${w.returningCount} returning`}
                >
                  {total > 0 ? (
                    <>
                      <div
                        className="w-full rounded-t bg-[#CBAD8D]"
                        style={{ height: `${newHeight}px` }}
                      />
                      <div
                        className="w-full bg-[#A48374]"
                        style={{ height: `${returningHeight}px` }}
                      />
                    </>
                  ) : (
                    <div className="h-px w-full bg-mist" />
                  )}
                </div>
                <span className="truncate text-xs">{w.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {total > 0 ? `${w.newCount} / ${w.returningCount}` : '0'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ backgroundColor: "#CBAD8D" }}
          />
          New
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ backgroundColor: "#A48374" }}
          />
          Returning
        </span>
      </div>
    </div>
  );
}

// ── Churn Risk Table ─────────────────────────────────────────────

function ChurnRiskTable({
  customers,
  userRole,
}: {
  customers: ChurnRiskCustomer[];
  userRole: string;
}) {
  if (customers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No at-risk customers found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Last Purchase</TableHead>
            <TableHead className="text-right">Days Since</TableHead>
            <TableHead className="text-right">Lifetime Spend</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell className="font-mono text-sm">
                {maskPhone(c.phone, userRole)}
              </TableCell>
              <TableCell>{fmtDate(c.lastPurchaseDate)}</TableCell>
              <TableCell className="text-right">{c.daysSince}</TableCell>
              <TableCell className="text-right">
                {fmtCurrency(c.lifetimeSpend)}
              </TableCell>
              <TableCell>
                <ChurnBadge days={c.daysSince} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Churn Badge ──────────────────────────────────────────────────

function ChurnBadge({ days }: { days: number }) {
  if (days >= 90) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        Churned
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
      At Risk
    </Badge>
  );
}

// ── Skeleton helper ──────────────────────────────────────────────

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
