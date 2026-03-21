"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportContext } from "@/lib/reports/ReportContext";

// ── Types ────────────────────────────────────────────────────────

interface VariantRow {
  id: string;
  sku: string;
  productName: string;
  variantLabel: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  costPrice: string;
  stockValue: string;
  lastSaleDate: string | null;
}

interface Totals {
  totalSKUs: number;
  totalUnits: number;
  totalStockValue: string;
}

interface ValuationData {
  variants: VariantRow[];
  totals: Totals;
  unfilteredTotals: Totals;
}

interface ValuationResponse {
  success: boolean;
  data: ValuationData;
  error?: { code: string; message: string };
}

// ── Helpers ──────────────────────────────────────────────────────

function fmtCurrency(val: string): string {
  const num = parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(num);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchValuation(
  lowStock: boolean,
  deadStock: boolean,
): Promise<ValuationData> {
  const params = new URLSearchParams();
  if (lowStock) params.set("lowStock", "true");
  if (deadStock) params.set("deadStock", "true");
  const res = await fetch(
    `/api/reports/inventory-valuation?${params.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch report");
  const json: ValuationResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Unknown error");
  return json.data;
}

// ── Component ────────────────────────────────────────────────────

export default function InventoryValuationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lowStock = searchParams.get("lowStock") === "true";
  const deadStock = searchParams.get("deadStock") === "true";
  const { setReportData } = useReportContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory-valuation", lowStock, deadStock],
    queryFn: () => fetchValuation(lowStock, deadStock),
  });

  // Push data to ReportContext for export
  useEffect(() => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.variants.map((v) => ({
      SKU: v.sku,
      Product: v.productName,
      Variant: v.variantLabel,
      Category: v.categoryName,
      "Stock Qty": v.stockQuantity,
      "Cost Price": v.costPrice,
      "Stock Value": v.stockValue,
      "Last Sale": v.lastSaleDate ? fmtDate(v.lastSaleDate) : "Never",
    }));
    setReportData(rows);
  }, [data, setReportData]);

  function toggleParam(key: string, current: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (!current) {
      params.set(key, "true");
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
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

  const { variants, totals, unfilteredTotals } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* ── Summary Cards (always unfiltered) ─────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total SKUs" value={fmtNumber(unfilteredTotals.totalSKUs)} />
        <StatCard
          label="Total Units"
          value={fmtNumber(unfilteredTotals.totalUnits)}
        />
        <StatCard
          label="Total Stock Value"
          value={fmtCurrency(unfilteredTotals.totalStockValue)}
        />
      </div>

      {/* ── Filter Toggles ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={lowStock}
            onCheckedChange={() => toggleParam("lowStock", lowStock)}
          />
          Low Stock Only
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={deadStock}
            onCheckedChange={() => toggleParam("deadStock", deadStock)}
          />
          Dead Stock Only
        </label>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Stock Qty</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead className="text-right">Last Sale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No variants match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">{v.sku}</TableCell>
                  <TableCell>{v.productName}</TableCell>
                  <TableCell>{v.variantLabel}</TableCell>
                  <TableCell
                    className={`text-right ${
                      v.stockQuantity <= v.lowStockThreshold
                        ? "font-semibold text-red-600"
                        : ""
                    }`}
                  >
                    {v.stockQuantity}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(v.costPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(v.stockValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.lastSaleDate ? fmtDate(v.lastSaleDate) : "Never"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {variants.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={3}>
                  Total: {fmtNumber(totals.totalSKUs)} SKUs
                </TableCell>
                <TableCell className="text-right">
                  {fmtNumber(totals.totalUnits)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">
                  {fmtCurrency(totals.totalStockValue)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
