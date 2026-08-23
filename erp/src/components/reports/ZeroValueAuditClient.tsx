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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useReportContext } from "@/lib/reports/ReportContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { exportToCSV, type ReportColumn, type ReportRow } from "@/lib/reports/export";

// ── Helpers ──────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Default window: last 24 hours (doc 35).
function defaultFrom(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return toYMD(d);
}

function defaultTo(): string {
  return toYMD(new Date());
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Types ────────────────────────────────────────────────────────

interface ZeroValueRow {
  saleId: string;
  staff: string;
  reason: string | null;
  reasonLabel: string;
  linkedOrderRef: string | null;
  customerName: string;
  customerPhone: string;
  saleNumber: string;
  completedAt: string;
}

interface ZeroValueData {
  rows: ZeroValueRow[];
  summaryByReason: Record<string, number>;
  total: number;
}

interface ZeroValueResponse {
  success: boolean;
  data: ZeroValueData;
  error?: { code: string; message: string };
}

const EXPORT_COLUMNS: ReportColumn[] = [
  { key: "saleNumber", header: "Sale #" },
  { key: "staff", header: "Issuer Staff" },
  { key: "reasonLabel", header: "Reason" },
  { key: "linkedOrderRef", header: "Linked Order" },
  { key: "customerName", header: "Recipient" },
  { key: "customerPhone", header: "Phone" },
  { key: "completedAt", header: "Timestamp" },
];

// ── Fetch ────────────────────────────────────────────────────────

async function fetchZeroValue(from: string, to: string): Promise<ZeroValueData> {
  const res = await fetch(
    `/api/reports/zero-value-sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (res.status === 403) {
    throw new Error("FORBIDDEN");
  }
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: ZeroValueResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Component ────────────────────────────────────────────────────

export default function ZeroValueAuditClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const { setReportData } = useReportContext();
  const { hasPermission } = usePermissions();
  const canView = hasPermission(PERMISSIONS.REPORT.viewZeroValueReport);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["zero-value-sales-report", from, to],
    queryFn: () => fetchZeroValue(from, to),
    enabled: canView,
  });

  const exportRows = useMemo<ReportRow[]>(
    () =>
      (data?.rows ?? []).map((r) => ({
        saleNumber: r.saleNumber,
        staff: r.staff,
        reasonLabel: r.reasonLabel,
        linkedOrderRef: r.linkedOrderRef ?? "",
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        completedAt: fmtTimestamp(r.completedAt),
      })),
    [data?.rows],
  );

  useEffect(() => {
    setReportData(exportRows);
  }, [exportRows, setReportData]);

  const handleExport = async () => {
    if (isExporting || exportRows.length === 0) return;
    setIsExporting(true);
    try {
      await exportToCSV(exportRows, EXPORT_COLUMNS, "Zero_Value_Orders");
    } finally {
      setIsExporting(false);
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center font-body text-sm text-mist">
          You do not have permission to view the Zero-Value Audit dashboard.
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summaryByReason ?? {};

  return (
    <div className="space-y-4">
      {/* Summary counts per reason */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: "BANK_PAYMENT", label: "Bank Payment", color: "text-[#2D6A4F]" },
          { key: "PRODUCT_REPLACEMENT", label: "Replacement", color: "text-terracotta" },
          { key: "COMPLIMENTARY_GIFT", label: "Gift", color: "text-sand" },
        ].map((item) => (
          <Card key={item.key}>
            <CardContent className="p-4">
              <p className={`font-display text-2xl font-bold ${item.color}`}>
                {summary[item.key] ?? 0}
              </p>
              <p className="font-body text-xs text-mist">{item.label}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <p className="font-display text-2xl font-bold text-espresso">
              {data?.total ?? 0}
            </p>
            <p className="font-body text-xs text-mist">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base text-espresso">
            Zero-Value Orders
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isExporting || (data?.rows?.length ?? 0) === 0}
            onClick={handleExport}
          >
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <p className="py-6 text-center font-body text-sm text-[#9B2226]">
              {error.message === "FORBIDDEN"
                ? "You do not have permission to view this report."
                : "Failed to load report."}
            </p>
          ) : (data?.rows?.length ?? 0) === 0 ? (
            <p className="py-6 text-center font-body text-sm text-mist">
              No zero-value orders in the selected window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale #</TableHead>
                    <TableHead>Issuer Staff</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Linked Order</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.rows.map((row) => (
                    <TableRow key={row.saleId}>
                      <TableCell className="font-mono text-xs">
                        {row.saleNumber}
                      </TableCell>
                      <TableCell className="font-body text-sm">
                        {row.staff}
                      </TableCell>
                      <TableCell className="font-body text-sm">
                        {row.reasonLabel}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.linkedOrderRef
                          ? row.linkedOrderRef.slice(0, 8).toUpperCase()
                          : "—"}
                      </TableCell>
                      <TableCell className="font-body text-sm">
                        {row.customerName}
                      </TableCell>
                      <TableCell className="font-body text-sm">
                        {row.customerPhone}
                      </TableCell>
                      <TableCell className="font-body text-xs text-mist">
                        {fmtTimestamp(row.completedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
