import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import Decimal from "decimal.js";

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

// ── Raw query row types ──────────────────────────────────────────

interface CategorySalesRow {
  categoryId: string;
  categoryName: string;
  totalSales: Decimal;
}

interface CategoryReturnsRow {
  categoryId: string;
  categoryName: string;
  totalRefunds: Decimal;
}

interface TopReturnedRow {
  productName: string;
  unitsReturned: bigint;
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

    const url = request.nextUrl;
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson("BAD_REQUEST", "Invalid date parameters", 400);
    }

    // ── Parallel queries ─────────────────────────────────────────

    const [
      salesAggregate,
      returnsAggregate,
      returnsCount,
      categorySalesRows,
      categoryReturnsRows,
      reasonGroups,
      topReturnedRows,
    ] = await Promise.all([
      // a) Total revenue from COMPLETED sales
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        _sum: { totalAmount: true },
      }),

      // a) Total refunds from COMPLETED returns
      prisma.return.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        _sum: { refundAmount: true },
      }),

      // a) Return count
      prisma.return.count({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
      }),

      // b) Category sales: SaleLine → ProductVariant → Product → Category
      prisma.$queryRaw<CategorySalesRow[]>(Prisma.sql`
        SELECT
          c."id" AS "categoryId",
          c."name" AS "categoryName",
          COALESCE(SUM(sl."lineTotalAfterDiscount"), 0) AS "totalSales"
        FROM "sale_lines" sl
        JOIN "sales" s ON s."id" = sl."saleId"
        JOIN "product_variants" pv ON pv."id" = sl."variantId"
        JOIN "products" p ON p."id" = pv."productId"
        JOIN "categories" c ON c."id" = p."categoryId"
        WHERE s."tenantId" = ${tenantId}
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
        GROUP BY c."id", c."name"
        ORDER BY "totalSales" DESC
      `),

      // c) Category returns: ReturnLine → ProductVariant → Product → Category
      prisma.$queryRaw<CategoryReturnsRow[]>(Prisma.sql`
        SELECT
          c."id" AS "categoryId",
          c."name" AS "categoryName",
          COALESCE(SUM(rl."lineRefundAmount"), 0) AS "totalRefunds"
        FROM "return_lines" rl
        JOIN "returns" r ON r."id" = rl."returnId"
        JOIN "product_variants" pv ON pv."id" = rl."variantId"
        JOIN "products" p ON p."id" = pv."productId"
        JOIN "categories" c ON c."id" = p."categoryId"
        WHERE r."tenantId" = ${tenantId}
          AND r."status" = 'COMPLETED'
          AND r."createdAt" >= ${from}
          AND r."createdAt" <= ${to}
        GROUP BY c."id", c."name"
        ORDER BY "totalRefunds" DESC
      `),

      // d) Return reasons grouped
      prisma.return.groupBy({
        by: ["reason"],
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
        _sum: { refundAmount: true },
      }),

      // e) Top 10 most-returned products
      prisma.$queryRaw<TopReturnedRow[]>(Prisma.sql`
        SELECT
          p."name" AS "productName",
          SUM(rl."quantity") AS "unitsReturned",
          SUM(rl."lineRefundAmount") AS "returnValue"
        FROM "return_lines" rl
        JOIN "returns" r ON r."id" = rl."returnId"
        JOIN "product_variants" pv ON pv."id" = rl."variantId"
        JOIN "products" p ON p."id" = pv."productId"
        WHERE r."tenantId" = ${tenantId}
          AND r."status" = 'COMPLETED'
          AND r."createdAt" >= ${from}
          AND r."createdAt" <= ${to}
        GROUP BY p."id", p."name"
        ORDER BY "unitsReturned" DESC
        LIMIT 10
      `),
    ]);

    // ── Overall stats ────────────────────────────────────────────

    const totalRevenue = new Decimal(
      salesAggregate._sum.totalAmount?.toString() ?? "0",
    );
    const totalRefunds = new Decimal(
      returnsAggregate._sum.refundAmount?.toString() ?? "0",
    );
    const overallReturnRate = totalRevenue.isZero()
      ? "0.00"
      : totalRefunds.div(totalRevenue).mul(100).toFixed(2);

    const overall = {
      totalRevenue: totalRevenue.toFixed(2),
      totalRefunds: totalRefunds.toFixed(2),
      totalReturns: returnsCount,
      returnRate: overallReturnRate,
    };

    // ── Merge category data ──────────────────────────────────────

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; totalSales: Decimal; totalRefunds: Decimal }
    >();

    for (const row of categorySalesRows) {
      categoryMap.set(row.categoryId, {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        totalSales: new Decimal(row.totalSales.toString()),
        totalRefunds: new Decimal(0),
      });
    }

    for (const row of categoryReturnsRows) {
      const existing = categoryMap.get(row.categoryId);
      if (existing) {
        existing.totalRefunds = new Decimal(row.totalRefunds.toString());
      } else {
        categoryMap.set(row.categoryId, {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          totalSales: new Decimal(0),
          totalRefunds: new Decimal(row.totalRefunds.toString()),
        });
      }
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

    const reasons = reasonGroups.map((g) => ({
      reason: g.reason,
      count: g._count._all,
      refundAmount: new Decimal(
        g._sum.refundAmount?.toString() ?? "0",
      ).toFixed(2),
    }));

    // Sort by count descending
    reasons.sort((a, b) => b.count - a.count);

    // ── Top returned products ────────────────────────────────────

    const topReturned = topReturnedRows.map((row, i) => ({
      rank: i + 1,
      productName: row.productName,
      unitsReturned: Number(row.unitsReturned),
      returnValue: new Decimal(row.returnValue.toString()).toFixed(2),
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
