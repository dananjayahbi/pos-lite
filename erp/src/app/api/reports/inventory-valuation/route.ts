import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorJson("UNAUTHORIZED", "Not authenticated", 401);
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return errorJson("UNAUTHORIZED", "No tenant", 401);
    }

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewStockReport);
    if (forbidden) return forbidden;

    const url = request.nextUrl;
    const lowStock = url.searchParams.get("lowStock") === "true";
    const deadStock = url.searchParams.get("deadStock") === "true";

    // ── 1. Fetch all active variants with product + category ─────
    const variants = await prisma.productVariant.findMany({
      where: {
        tenantId,
        deletedAt: null,
        product: { deletedAt: null, isArchived: false },
      },
      include: {
        product: {
          include: { category: { select: { name: true } } },
        },
        batchTrackings: {
          where: { quantity: { gt: 0 } },
          select: { expiryDate: true },
        },
      },
      orderBy: { sku: "asc" },
    });

    // ── 2. Get last sale dates per variant ────────────────────────
    const lastSaleByVariant = await prisma.saleLine.groupBy({
      by: ["variantId"],
      where: {
        sale: { tenantId, status: "COMPLETED" },
        variantId: { in: variants.map((v) => v.id) },
      },
      _max: { createdAt: true },
    });

    const lastSaleMap = new Map<string, Date>();
    for (const row of lastSaleByVariant) {
      const d = row._max.createdAt;
      if (d) lastSaleMap.set(row.variantId, d);
    }

    // ── 3. Build full list with computed fields ──────────────────
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

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
      expiringBatches: number;
      expiredBatches: number;
    }

    const allRows: VariantRow[] = variants.map((v) => {
      const cost = new Decimal(v.costPrice.toString());
      const value = cost.times(v.stockQuantity);
      const parts = [v.form, v.packSize].filter(Boolean);
      const lastSale = lastSaleMap.get(v.id) ?? null;

      // Expiry summary from batch trackings (doc 30).
      let expiringBatches = 0;
      let expiredBatches = 0;
      const windowMs = 30 * 86_400_000;
      for (const batch of v.batchTrackings) {
        const expiry = batch.expiryDate;
        if (!expiry) continue;
        const diff = expiry.getTime() - now.getTime();
        if (diff <= 0) expiredBatches += 1;
        else if (diff <= windowMs) expiringBatches += 1;
      }

      return {
        id: v.id,
        sku: v.sku,
        productName: v.product.name,
        variantLabel: parts.length > 0 ? parts.join(" / ") : "Default",
        categoryName: v.product.category.name,
        stockQuantity: v.stockQuantity,
        lowStockThreshold: v.lowStockThreshold,
        costPrice: cost.toFixed(2),
        stockValue: value.toFixed(2),
        lastSaleDate: lastSale ? lastSale.toISOString() : null,
        expiringBatches,
        expiredBatches,
      };
    });

    // ── 4. Compute unfiltered totals ─────────────────────────────
    let totalSKUs = allRows.length;
    let totalUnits = 0;
    let totalStockValue = new Decimal(0);

    for (const row of allRows) {
      totalUnits += row.stockQuantity;
      totalStockValue = totalStockValue.plus(row.stockValue);
    }

    const unfilteredTotals = {
      totalSKUs,
      totalUnits,
      totalStockValue: totalStockValue.toFixed(2),
    };

    // ── 5. Apply filters ─────────────────────────────────────────
    let filtered = allRows;

    if (lowStock) {
      filtered = filtered.filter(
        (r) => r.stockQuantity <= r.lowStockThreshold,
      );
    }

    if (deadStock) {
      filtered = filtered.filter((r) => {
        if (!r.lastSaleDate) return false; // never sold → exclude from dead stock
        return new Date(r.lastSaleDate) < ninetyDaysAgo;
      });
    }

    // ── 6. Compute filtered totals ───────────────────────────────
    let filteredUnits = 0;
    let filteredStockValue = new Decimal(0);

    for (const row of filtered) {
      filteredUnits += row.stockQuantity;
      filteredStockValue = filteredStockValue.plus(row.stockValue);
    }

    const totals = {
      totalSKUs: filtered.length,
      totalUnits: filteredUnits,
      totalStockValue: filteredStockValue.toFixed(2),
    };

    return NextResponse.json({
      success: true,
      data: { variants: filtered, totals, unfilteredTotals },
    });
  } catch (err) {
    console.error("[inventory-valuation] Error:", err);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}
