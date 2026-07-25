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
import { Badge } from "@/components/ui/badge";
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

function roleBadgeVariant(
  role: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "OWNER":
    case "SUPER_ADMIN":
      return "destructive";
    case "MANAGER":
      return "default";
    default:
      return "secondary";
  }
}

// ── Types ────────────────────────────────────────────────────────

interface StaffRow {
  userId: string;
  email: string;
  role: string;
  salesCount: number;
  revenue: string;
  aov: string;
  hoursWorked: string;
  commissionEarned: string;
  commissionPaid: string;
}

interface StaffTotals {
  totalSalesCount: number;
  totalRevenue: string;
  totalAov: string;
  totalHoursWorked: string;
  totalCommissionEarned: string;
  totalCommissionPaid: string;
}

interface StaffData {
  staff: StaffRow[];
  totals: StaffTotals;
  userRole: string;
}

interface StaffResponse {
  success: boolean;
  data: StaffData;
  error?: { code: string; message: string };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchStaffPerformance(
  from: string,
  to: string,
): Promise<StaffData> {
  const res = await fetch(
    `/api/reports/staff-performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (res.status === 403) {
    throw new Error("ACCESS_DENIED");
  }
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: StaffResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Sort Logic ───────────────────────────────────────────────────

type SortKey = "salesCount" | "revenue" | "hoursWorked" | "commissionEarned";
type SortDir = "asc" | "desc";

function sortStaff(
  staff: StaffRow[],
  key: SortKey,
  dir: SortDir,
): StaffRow[] {
  return [...staff].sort((a, b) => {
    const av =
      key === "salesCount" ? a.salesCount : parseFloat(a[key]);
    const bv =
      key === "salesCount" ? b.salesCount : parseFloat(b[key]);
    return dir === "asc" ? av - bv : bv - av;
  });
}

// ── Component ────────────────────────────────────────────────────

export default function StaffPerformanceClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const { setReportData } = useReportContext();

  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-performance", from, to],
    queryFn: () => fetchStaffPerformance(from, to),
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return sortStaff(data.staff, sortKey, sortDir);
  }, [data, sortKey, sortDir]);

  // Bar chart data — sort by revenue desc for chart
  const chartStaff = useMemo(() => {
    if (!data) return [];
    return [...data.staff].sort(
      (a, b) => parseFloat(b.revenue) - parseFloat(a.revenue),
    );
  }, [data]);

  const maxRevenue = useMemo(() => {
    if (chartStaff.length === 0) return 1;
    return Math.max(...chartStaff.map((s) => parseFloat(s.revenue)), 1);
  }, [chartStaff]);

  const avgRevenue = useMemo(() => {
    if (!data || data.staff.length === 0) return 0;
    return parseFloat(data.totals.totalRevenue) / data.staff.length;
  }, [data]);

  // Push data to ReportContext for export
  useEffect(() => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.staff.map((s) => ({
      Email: s.email,
      Role: s.role,
      "Hours Worked": s.hoursWorked,
      "Sales Count": s.salesCount,
      "Total Revenue": s.revenue,
      AOV: s.aov,
      "Commission Earned": s.commissionEarned,
      "Commission Paid": s.commissionPaid,
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
    if (error.message === "ACCESS_DENIED") {
      return (
        <div className="mx-auto max-w-5xl p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center text-red-700">
              <p className="text-lg font-semibold">Access Denied</p>
              <p className="mt-1 text-sm">
                You do not have permission to view this report.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const isCashier = data.userRole === "CASHIER";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* ── CASHIER Info Alert ────────────────────────────── */}
      {isCashier && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Viewing your own performance data only.
        </div>
      )}

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Sales Count"
          value={String(data.totals.totalSalesCount)}
        />
        <StatCard
          label="Total Revenue"
          value={fmtCurrency(data.totals.totalRevenue)}
        />
        <StatCard label="Avg Order" value={fmtCurrency(data.totals.totalAov)} />
        <StatCard
          label="Hours Worked"
          value={`${data.totals.totalHoursWorked}h`}
        />
        <StatCard
          label="Commission Earned"
          value={fmtCurrency(data.totals.totalCommissionEarned)}
        />
        <StatCard
          label="Commission Paid"
          value={fmtCurrency(data.totals.totalCommissionPaid)}
        />
      </div>

      {/* ── Revenue Bar Chart with Average Line ───────────── */}
      {chartStaff.length > 0 && (
        <Card>
          <CardHeader className="bg-mist rounded-t-lg">
            <CardTitle className="text-espresso text-base">
              Revenue per Staff
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {chartStaff.map((s) => (
              <div key={s.userId} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm text-espresso">
                  {s.email}
                </span>
                <div className="relative flex-1 rounded-full bg-pearl h-6">
                  <div
                    className="h-6 rounded-full"
                    style={{
                      width: `${(parseFloat(s.revenue) / maxRevenue) * 100}%`,
                      backgroundColor: "#A48374",
                    }}
                  />
                  {/* average reference line */}
                  <div
                    className="absolute top-0 h-6 border-l-2 border-dashed border-mist"
                    style={{
                      left: `${(avgRevenue / maxRevenue) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-28 text-right font-mono text-sm">
                  {fmtCurrency(s.revenue)}
                </span>
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <span
                className="inline-block h-0.5 w-6 border-t-2 border-dashed border-mist"
                aria-hidden="true"
              />
              Average ({fmtCurrency(avgRevenue)})
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Data Table ────────────────────────────────────── */}
      <Card>
        <CardHeader className="bg-mist rounded-t-lg">
          <CardTitle className="text-espresso text-base">
            Staff Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No staff data for this date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort("hoursWorked")}
                    >
                      Hours{sortIndicator("hoursWorked")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort("salesCount")}
                    >
                      Sales{sortIndicator("salesCount")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort("revenue")}
                    >
                      Revenue{sortIndicator("revenue")}
                    </TableHead>
                    <TableHead className="text-right">AOV</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort("commissionEarned")}
                    >
                      Comm. Earned{sortIndicator("commissionEarned")}
                    </TableHead>
                    <TableHead className="text-right">Comm. Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(s.role)}>
                          {s.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.hoursWorked}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.salesCount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtCurrency(s.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtCurrency(s.aov)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtCurrency(s.commissionEarned)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtCurrency(s.commissionPaid)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Totals</TableCell>
                    <TableCell className="text-right font-mono">
                      {data.totals.totalHoursWorked}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {data.totals.totalSalesCount}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(data.totals.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(data.totals.totalAov)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(data.totals.totalCommissionEarned)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(data.totals.totalCommissionPaid)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold text-espresso">{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-6 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
