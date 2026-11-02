import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { saleAccountingDateWhere, netRefundAmount } from '@/lib/reports/accounting';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

function defaultFrom(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultTo(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

interface CategoryTotals {
  categoryId: string;
  categoryName: string;
  totalSales: Decimal;
  totalRefunds: Decimal;
}

interface ProductReturnTotals {
  productName: string;
  unitsReturned: number;
  returnValue: Decimal;
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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewSalesReport);
    if (forbidden) return forbidden;

    const url = request.nextUrl;
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson("BAD_REQUEST", "Invalid date parameters", 400);
    }

    // ── Parallel queries ─────────────────────────────────────────
    const [salesAggregate, returns, saleLines, returnLines] = await Promise.all([
      // a) Product revenue for the accounting period. Excludes tax/delivery and
      //    includes the cart-level discount.
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          ...saleAccountingDateWhere(from, to),
        },
        _sum: { subtotal: true, discountAmount: true },
      }),

      // b) Completed returns in the period, with the original sale so refunds
      //    can be restated on the same post-cart-discount basis.
      prisma.return.findMany({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          reason: true,
          refundAmount: true,
          originalSale: { select: { subtotal: true, discountAmount: true } },
        },
      }),

      // c) Sale lines for category attribution.
      prisma.saleLine.findMany({
        where: {
          sale: {
            tenantId,
            status: "COMPLETED",
            ...saleAccountingDateWhere(from, to),
          },
        },
        select: {
          id: true,
          saleId: true,
          variantId: true,
          lineTotalAfterDiscount: true,
          sale: { select: { subtotal: true, discountAmount: true } },
          variant: {
            select: {
              product: {
                select: { category: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: [{ saleId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),

      // d) Return lines for category + product attribution.
      prisma.returnLine.findMany({
        where: {
          return: {
            tenantId,
            status: "COMPLETED",
            createdAt: { gte: from, lte: to },
          },
        },
        select: {
          variantId: true,
          quantity: true,
          lineRefundAmount: true,
          return: {
            select: {
              originalSale: {
                select: { subtotal: true, discountAmount: true },
              },
            },
          },
        },
      }),
    ]);

    // ReturnLine has no direct variant relation, so resolve product/category
    // labels for the returned variants in one extra query.
    const returnVariantIds = [...new Set(returnLines.map((line) => line.variantId))];
    const returnVariants =
      returnVariantIds.length > 0
        ? await prisma.productVariant.findMany({
            where: { id: { in: returnVariantIds }, tenantId },
            select: {
              id: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          })
        : [];
    const returnVariantMap = new Map(returnVariants.map((v) => [v.id, v]));

    // ── Overall stats ────────────────────────────────────────────
    const totalRevenue = new Decimal(
      salesAggregate._sum.subtotal?.toString() ?? "0",
    ).minus(
      new Decimal(salesAggregate._sum.discountAmount?.toString() ?? "0"),
    );
    const totalRefunds = returns.reduce(
      (sum, row) =>
        sum.plus(
          netRefundAmount(
            row.refundAmount,
            row.originalSale.subtotal,
            row.originalSale.discountAmount,
          ),
        ),
      new Decimal(0),
    );
    const overallReturnRate = totalRevenue.isZero()
      ? "0.00"
      : totalRefunds.div(totalRevenue).mul(100).toFixed(2);

    const overall = {
      totalRevenue: totalRevenue.toFixed(2),
      totalRefunds: totalRefunds.toFixed(2),
      totalReturns: returns.length,
      returnRate: overallReturnRate,
    };

    // ── Merge category data ──────────────────────────────────────
    const categoryMap = new Map<string, CategoryTotals>();

    const linesBySale = new Map<string, typeof saleLines>();
    for (const line of saleLines) {
      const current = linesBySale.get(line.saleId);
      if (current) current.push(line);
      else linesBySale.set(line.saleId, [line]);
    }

    for (const lines of linesBySale.values()) {
      const lineTotals = lines.map(
        (line) => new Decimal(line.lineTotalAfterDiscount.toString()),
      );
      const cartDiscount = new Decimal(
        lines[0]!.sale.discountAmount.toString(),
      );
      const shares = allocateCartDiscountShares(lineTotals, cartDiscount);

      lines.forEach((line, index) => {
        const category = line.variant.product.category;
        const entry = categoryMap.get(category.id) ?? {
          categoryId: category.id,
          categoryName: category.name,
          totalSales: new Decimal(0),
          totalRefunds: new Decimal(0),
        };
        entry.totalSales = entry.totalSales.plus(
          lineTotals[index]!.minus(shares[index]!),
        );
        categoryMap.set(category.id, entry);
      });
    }

    for (const line of returnLines) {
      const product = returnVariantMap.get(line.variantId)?.product;
      if (!product) continue;
      const category = product.category;
      const entry = categoryMap.get(category.id) ?? {
        categoryId: category.id,
        categoryName: category.name,
        totalSales: new Decimal(0),
        totalRefunds: new Decimal(0),
      };
      entry.totalRefunds = entry.totalRefunds.plus(
        netRefundAmount(
          line.lineRefundAmount,
          line.return.originalSale.subtotal,
          line.return.originalSale.discountAmount,
        ),
      );
      categoryMap.set(category.id, entry);
    }

    const categories = Array.from(categoryMap.values()).map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      totalSales: cat.totalSales.toFixed(2),
      totalRefunds: cat.totalRefunds.toFixed(2),
      returnRate: cat.totalSales.isZero()
        ? "0.00"
        : cat.totalRefunds.div(cat.totalSales).mul(100).toFixed(2),
    }));

    // Sort by return rate descending
    categories.sort((a, b) => parseFloat(b.returnRate) - parseFloat(a.returnRate));

    // ── Reasons ──────────────────────────────────────────────────
    const reasonMap = new Map<string, { count: number; refundAmount: Decimal }>();
    for (const row of returns) {
      const entry = reasonMap.get(row.reason) ?? {
        count: 0,
        refundAmount: new Decimal(0),
      };
      entry.count += 1;
      entry.refundAmount = entry.refundAmount.plus(
        netRefundAmount(
          row.refundAmount,
          row.originalSale.subtotal,
          row.originalSale.discountAmount,
        ),
      );
      reasonMap.set(row.reason, entry);
    }

    const reasons = Array.from(reasonMap.entries())
      .map(([reason, entry]) => ({
        reason,
        count: entry.count,
        refundAmount: entry.refundAmount.toFixed(2),
      }))
      .sort((a, b) => b.count - a.count);

    // ── Top returned products ────────────────────────────────────
    const productMap = new Map<string, ProductReturnTotals>();
    for (const line of returnLines) {
      const product = returnVariantMap.get(line.variantId)?.product;
      if (!product) continue;
      const entry = productMap.get(product.id) ?? {
        productName: product.name,
        unitsReturned: 0,
        returnValue: new Decimal(0),
      };
      entry.unitsReturned += line.quantity;
      entry.returnValue = entry.returnValue.plus(
        netRefundAmount(
          line.lineRefundAmount,
          line.return.originalSale.subtotal,
          line.return.originalSale.discountAmount,
        ),
      );
      productMap.set(product.id, entry);
    }

    const topReturned = Array.from(productMap.values())
      .sort((a, b) => b.unitsReturned - a.unitsReturned)
      .slice(0, 10)
      .map((row, i) => ({
        rank: i + 1,
        productName: row.productName,
        unitsReturned: row.unitsReturned,
        returnValue: row.returnValue.toFixed(2),
      }));

    return NextResponse.json({
      success: true,
      data: { overall, categories, reasons, topReturned },
    });
  } catch (err) {
    console.error("Return rate report error:", err);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}

