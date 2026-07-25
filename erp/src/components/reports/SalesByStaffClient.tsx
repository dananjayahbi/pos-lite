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
  cashierId: string;
  staffName: string;
  role: string;
  transactions: number;
  totalRevenue: string;
  avgTransactionValue: string;
  commissionEarned: string;
}

interface StaffTotals {
  totalTransactions: number;
  totalRevenue: string;
  avgTransactionValue: string;
  totalCommission: string;
}

interface StaffData {
  staff: StaffRow[];
  totals: StaffTotals;
}

interface StaffResponse {
  success: boolean;
  data: StaffData;
  error?: { code: string; message: string };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchStaff(from: string, to: string): Promise<StaffData> {
  const res = await fetch(
    `/api/reports/sales-by-staff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: StaffResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Sort Logic ───────────────────────────────────────────────────

type SortKey = "transactions" | "totalRevenue";
type SortDir = "asc" | "desc";

function sortStaff(
  staff: StaffRow[],
  key: SortKey,
  dir: SortDir,
): StaffRow[] {
  return [...staff].sort((a, b) => {
    const av =
      key === "transactions" ? a.transactions : parseFloat(a[key]);
    const bv =
      key === "transactions" ? b.transactions : parseFloat(b[key]);
    return dir === "asc" ? av - bv : bv - av;
  });
}

// ── Component ────────────────────────────────────────────────────

export default function SalesByStaffClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const { setReportData } = useReportContext();

  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-by-staff", from, to],
    queryFn: () => fetchStaff(from, to),
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return sortStaff(data.staff, sortKey, sortDir);
  }, [data, sortKey, sortDir]);

  const topStaff = useMemo(() => sorted.slice(0, 10), [sorted]);
  const maxBar = useMemo(() => {
    if (topStaff.length === 0) return 1;
    return Math.max(...topStaff.map((s) => parseFloat(s.totalRevenue)), 1);
  }, [topStaff]);

  // Push data to ReportContext for export
  useEffect(() => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.staff.map((s) => ({
      "Staff Name": s.staffName,
      Role: s.role,
      Transactions: s.transactions,
      "Total Revenue": s.totalRevenue,
      "Avg Transaction": s.avgTransactionValue,
      "Commission Earned": s.commissionEarned,
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
        <StatCard
          label="Total Transactions"
          value={String(data.totals.totalTransactions)}
        />
        <StatCard
          label="Total Revenue"
          value={fmtCurrency(data.totals.totalRevenue)}
        />
        <StatCard
          label="Avg Transaction"
          value={fmtCurrency(data.totals.avgTransactionValue)}
        />
        <StatCard
          label="Total Commission"
          value={fmtCurrency(data.totals.totalCommission)}
        />
      </div>

      {/* ── Top Staff Bar Chart ───────────────────────────── */}
      {topStaff.length > 0 && (
        <Card>
          <CardHeader className="bg-mist rounded-t-lg">
            <CardTitle className="text-espresso text-base">
              Top Staff by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {topStaff.map((item) => (
                <div key={item.cashierId} className="flex items-center gap-3">
                  <span className="w-36 truncate text-sm text-espresso">
                    {item.staffName}
                  </span>
                  <div className="flex-1 bg-pearl rounded-full h-6">
                    <div
                      className="h-6 rounded-full"
                      style={{
                        width: `${(parseFloat(item.totalRevenue) / maxBar) * 100}%`,
                        backgroundColor: "#A48374",
                      }}
                    />
                  </div>
                  <span className="w-28 text-right font-mono text-sm">
                    {fmtCurrency(item.totalRevenue)}
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
            Sales by Staff
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
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("transactions")}
                  >
                    Transactions{sortIndicator("transactions")}
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("totalRevenue")}
                  >
                    Total Revenue{sortIndicator("totalRevenue")}
                  </TableHead>
                  <TableHead className="text-right">Avg Transaction</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s) => (
                  <TableRow key={s.cashierId}>
                    <TableCell className="font-medium">
                      {s.staffName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(s.role)}>
                        {s.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {s.transactions}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(s.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(s.avgTransactionValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(s.commissionEarned)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Grand Total</TableCell>
                  <TableCell className="text-right font-mono">
                    {data.totals.totalTransactions}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(data.totals.totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(data.totals.avgTransactionValue)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(data.totals.totalCommission)}
                  </TableCell>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold font-mono text-espresso">
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
