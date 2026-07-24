"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportContext } from "@/lib/reports/ReportContext";

// ── Types ────────────────────────────────────────────────────────

interface Movement {
  id: string;
  createdAt: string;
  productName: string;
  sku: string;
  variantId: string;
  reason: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  actorEmail: string;
  note: string | null;
  saleId: string | null;
  purchaseOrderId: string | null;
  stockTakeSessionId: string | null;
}

interface SummaryItem {
  reason: string;
  netDelta: number;
  count: number;
}

interface StockMovementsData {
  movements: Movement[];
  total: number;
  summary: SummaryItem[];
}

interface ApiResponse {
  success: boolean;
  data: StockMovementsData;
  error?: { code: string; message: string };
}

// ── Constants ────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const REASON_OPTIONS = [
  "SALE",
  "SALE_RETURN",
  "PURCHASE_RECEIVED",
  "STOCK_TAKE_ADJUSTMENT",
  "FOUND",
  "DAMAGED",
  "STOLEN",
  "DATA_ERROR",
  "RETURNED_TO_SUPPLIER",
  "INITIAL_STOCK",
  "VOID_REVERSAL",
] as const;

const REASON_LABELS: Record<string, string> = {
  SALE: "Sale",
  SALE_RETURN: "Sale Return",
  PURCHASE_RECEIVED: "Purchase Received",
  STOCK_TAKE_ADJUSTMENT: "Stock Take Adj.",
  FOUND: "Found",
  DAMAGED: "Damaged",
  STOLEN: "Stolen",
  DATA_ERROR: "Data Error",
  RETURNED_TO_SUPPLIER: "Returned to Supplier",
  INITIAL_STOCK: "Initial Stock",
  VOID_REVERSAL: "Void Reversal",
};

// ── Badge colors by reason ───────────────────────────────────────

function reasonBadgeClasses(reason: string): string {
  switch (reason) {
    case "SALE":
      return "bg-[#3A2D28] text-white";
    case "SALE_RETURN":
    case "VOID_REVERSAL":
      return "bg-[#CBAD8D] text-[#3A2D28]";
    case "PURCHASE_RECEIVED":
    case "INITIAL_STOCK":
      return "bg-green-100 text-green-800";
    case "STOCK_TAKE_ADJUSTMENT":
    case "FOUND":
      return "bg-blue-100 text-blue-800";
    case "DAMAGED":
    case "STOLEN":
    case "DATA_ERROR":
      return "bg-red-100 text-red-800";
    case "RETURNED_TO_SUPPLIER":
      return "bg-orange-100 text-orange-800";
    default:
      return "";
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} ${month} ${year} ${time}`;
}

function fmtDelta(delta: number): { text: string; className: string } {
  if (delta > 0) {
    return { text: `+${delta}`, className: "text-green-600 font-semibold" };
  }
  if (delta < 0) {
    return {
      text: `\u2212${Math.abs(delta)}`,
      className: "text-red-600 font-semibold",
    };
  }
  return { text: "0", className: "text-muted-foreground" };
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchMovements(
  from: string,
  to: string,
  page: number,
  variantSearch: string,
  movementType: string,
): Promise<StockMovementsData> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("page", String(page));
  if (variantSearch) params.set("variantSearch", variantSearch);
  if (movementType) params.set("movementType", movementType);

  const res = await fetch(
    `/api/reports/stock-movements?${params.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: ApiResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Component ────────────────────────────────────────────────────

export default function StockMovementsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setReportData } = useReportContext();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const movementType = searchParams.get("movementType") ?? "";
  const urlSearch = searchParams.get("variantSearch") ?? "";

  // ── Debounced variant search ─────────────────────────────────
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) {
          params.set(k, v);
        } else {
          params.delete(k);
        }
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ variantSearch: value, page: "1" });
    }, 300);
  };

  // Sync searchInput if URL param changes externally
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["stock-movements", from, to, page, urlSearch, movementType],
    queryFn: () => fetchMovements(from, to, page, urlSearch, movementType),
  });

  // Push data to ReportContext for export
  useEffect(() => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.movements.map((m) => ({
      Date: fmtDate(m.createdAt),
      Product: m.productName,
      SKU: m.sku,
      "Movement Type": REASON_LABELS[m.reason] ?? m.reason,
      Delta: m.quantityDelta,
      "Qty Before": m.quantityBefore,
      "Qty After": m.quantityAfter,
      Actor: m.actorEmail,
      Reference: m.saleId
        ? `Sale: ${m.saleId}`
        : m.purchaseOrderId
          ? `PO: ${m.purchaseOrderId}`
          : "Manual",
    }));
    setReportData(rows);
  }, [data, setReportData]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const { movements, summary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* ── Summary Cards Strip ────────────────────────────── */}
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {summary.map((s) => {
            const delta = fmtDelta(s.netDelta);
            return (
              <Card key={s.reason} className="min-w-[160px] flex-1">
                <CardContent className="p-4">
                  <Badge
                    variant="outline"
                    className={reasonBadgeClasses(s.reason)}
                  >
                    {REASON_LABELS[s.reason] ?? s.reason}
                  </Badge>
                  <p className={`mt-2 text-lg font-bold ${delta.className}`}>
                    {delta.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.count} event{s.count !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Filter Controls ────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search Product / SKU
          </label>
          <Input
            placeholder="Search variant..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Movement Type
          </label>
          <Select
            value={movementType || "ALL"}
            onValueChange={(val) =>
              pushParams({
                movementType: val === "ALL" ? "" : val,
                page: "1",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {REASON_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {REASON_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant (SKU)</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No stock movements match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => {
                const delta = fmtDelta(m.quantityDelta);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmtDate(m.createdAt)}
                    </TableCell>
                    <TableCell>{m.productName}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {m.sku}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={reasonBadgeClasses(m.reason)}
                      >
                        {REASON_LABELS[m.reason] ?? m.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right ${delta.className}`}>
                      {delta.text}
                    </TableCell>
                    <TableCell className="text-sm">{m.actorEmail}</TableCell>
                    <TableCell>
                      <ReferenceCell movement={m} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} &middot; {data.total} total
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => pushParams({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => pushParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function ReferenceCell({ movement }: { movement: Movement }) {
  if (movement.saleId) {
    return (
      <a
        href={`/sales/${movement.saleId}`}
        className="text-sm text-[#A48374] underline-offset-2 hover:underline"
      >
        Sale
      </a>
    );
  }
  if (movement.purchaseOrderId) {
    return (
      <a
        href={`/purchase-orders/${movement.purchaseOrderId}`}
        className="text-sm text-[#A48374] underline-offset-2 hover:underline"
      >
        Purchase Order
      </a>
    );
  }
  return <span className="text-sm text-muted-foreground">Manual</span>;
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="min-w-[160px] flex-1">
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
