import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import Decimal from "decimal.js";
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { saleAccountingDateWhere, netRefundAmount } from '@/lib/reports/accounting';
import { summarizeCogsSource } from '@/lib/reports/cogsSource';
import { filterMonthKeysInPeriod } from '@/lib/reports/monthlyPeriod';

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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewProfitReport);
    if (forbidden) return forbidden;

    const url = request.nextUrl;
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson("BAD_REQUEST", "Invalid date parameters", 400);
    }

    // ── 1. Revenue: completed sales aggregate ────────────────────
    // Revenue only from sales that actually have line items: legacy zero-line
    // sales carry a header subtotal but no product revenue/COGS, so counting
    // them made the P&L disagree with Sales by Product by Rs 10,000
    // (ARGUS #435).
    const revenueAgg = await prisma.sale.aggregate({
      where: {
        tenantId,
        status: "COMPLETED",
        lines: { some: {} },
        ...saleAccountingDateWhere(from, to),
      },
      _sum: { subtotal: true, discountAmount: true },
      _count: true,
    });

    // Product revenue = line totals after line discounts, less the cart-level
    // discount. Tax and delivery are pass-through amounts, not trading revenue.
    const grossRevenue = new Decimal(
      revenueAgg._sum.subtotal?.toString() ?? "0",
    ).minus(new Decimal(revenueAgg._sum.discountAmount?.toString() ?? "0"));
    const saleCount = revenueAgg._count;

    // ── 2. Returns: completed returns aggregate ──────────────────
    const returnRows = await prisma.return.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      select: {
        refundAmount: true,
        originalSale: { select: { subtotal: true, discountAmount: true } },
      },
    });

    const totalReturns = returnRows.reduce(
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
    const returnCount = returnRows.length;

    // ── 3. Revenue by payment method ─────────────────────────────
    const revenueByMethod = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: {
        tenantId,
        status: "COMPLETED",
        lines: { some: {} },
        ...saleAccountingDateWhere(from, to),
      },
      _sum: { subtotal: true, discountAmount: true },
    });

    const revenueByPaymentMethod = revenueByMethod.map((r) => ({
      method: r.paymentMethod ?? "UNKNOWN",
      total: new Decimal(r._sum.subtotal?.toString() ?? "0")
        .minus(new Decimal(r._sum.discountAmount?.toString() ?? "0"))
        .toFixed(2),
    }));

    // ── 4. COGS: split snapshot cost from current-cost fallback (ARGUS #436) ─
    // The snapshot is historical truth; a missing snapshot falls back to the
    // variant's current cost, which is reported separately instead of being
    // silently mixed into one COGS number.
    const cogsResult = await prisma.$queryRaw<
      {
        snapshot_cogs: Decimal | null;
        fallback_cogs: Decimal | null;
        snapshot_lines: bigint | number | null;
        fallback_lines: bigint | number | null;
      }[]
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN sl."costPriceSnapshot" IS NOT NULL
          THEN sl."costPriceSnapshot" * sl."quantity" ELSE 0 END), 0) AS snapshot_cogs,
        COALESCE(SUM(CASE WHEN sl."costPriceSnapshot" IS NULL
          THEN pv."costPrice" * sl."quantity" ELSE 0 END), 0) AS fallback_cogs,
        COUNT(*) FILTER (WHERE sl."costPriceSnapshot" IS NOT NULL) AS snapshot_lines,
        COUNT(*) FILTER (WHERE sl."costPriceSnapshot" IS NULL) AS fallback_lines
      FROM sale_lines sl
      JOIN sales s ON sl."saleId" = s."id"
      JOIN product_variants pv ON sl."variantId" = pv."id"
      WHERE s."tenantId" = ${tenantId}
        AND s."status" = 'COMPLETED'
        AND COALESCE(s."saleDate", s."createdAt") >= ${from}
        AND COALESCE(s."saleDate", s."createdAt") <= ${to}
    `);

    const salesCogsSource = summarizeCogsSource({
      snapshotCogs: cogsResult[0]?.snapshot_cogs?.toString() ?? "0",
      fallbackCogs: cogsResult[0]?.fallback_cogs?.toString() ?? "0",
      snapshotLines: Number(cogsResult[0]?.snapshot_lines ?? 0),
      fallbackLines: Number(cogsResult[0]?.fallback_lines ?? 0),
    });
    const rawCOGS = new Decimal(salesCogsSource.total);

    // ── 5. Returned COGS (same snapshot/fallback split) ─────────
    const returnedCogsResult = await prisma.$queryRaw<
      {
        snapshot_cogs: Decimal | null;
        fallback_cogs: Decimal | null;
        snapshot_lines: bigint | number | null;
        fallback_lines: bigint | number | null;
      }[]
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN sl."costPriceSnapshot" IS NOT NULL
          THEN sl."costPriceSnapshot" * rl."quantity" ELSE 0 END), 0) AS snapshot_cogs,
        COALESCE(SUM(CASE WHEN sl."costPriceSnapshot" IS NULL
          THEN pv."costPrice" * rl."quantity" ELSE 0 END), 0) AS fallback_cogs,
        COUNT(*) FILTER (WHERE sl."costPriceSnapshot" IS NOT NULL) AS snapshot_lines,
        COUNT(*) FILTER (WHERE sl."costPriceSnapshot" IS NULL) AS fallback_lines
      FROM return_lines rl
      JOIN returns r ON rl."returnId" = r."id"
      JOIN sale_lines sl ON sl."id" = rl."originalSaleLineId"
      JOIN product_variants pv ON rl."variantId" = pv."id"
      WHERE r."tenantId" = ${tenantId}
        AND r."status" = 'COMPLETED'
        AND r."createdAt" >= ${from}
        AND r."createdAt" <= ${to}
    `);

    const returnedCogsSource = summarizeCogsSource({
      snapshotCogs: returnedCogsResult[0]?.snapshot_cogs?.toString() ?? "0",
      fallbackCogs: returnedCogsResult[0]?.fallback_cogs?.toString() ?? "0",
      snapshotLines: Number(returnedCogsResult[0]?.snapshot_lines ?? 0),
      fallbackLines: Number(returnedCogsResult[0]?.fallback_lines ?? 0),
    });
    const returnedCOGS = new Decimal(returnedCogsSource.total);

    // ── 6. Expenses ──────────────────────────────────────────────
    const expensesByCategory = await prisma.expense.groupBy({
      by: ["category"],
      where: {
        tenantId,
        expenseDate: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const expenseCategories = expensesByCategory.map((e) => ({
      category: e.category,
      total: new Decimal(e._sum.amount?.toString() ?? "0").toFixed(2),
    }));

    const expenseAgg = await prisma.expense.aggregate({
      where: {
        tenantId,
        expenseDate: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const totalExpenses = new Decimal(
      expenseAgg._sum.amount?.toString() ?? "0",
    );

    // ── 7. Monthly data (last 12 months) ─────────────────────────
    // Same accounting basis as the period totals above: product revenue
    // (subtotal − cart discount), product COGS, and returns netted in the month
    // they were processed.
    const monthlyRevenue = await prisma.$queryRaw<
      { month: Date; revenue: Decimal; sale_count: bigint }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', COALESCE("saleDate", "createdAt")) AS month,
             COALESCE(SUM("subtotal" - "discountAmount"), 0) AS revenue,
             COUNT(*)::bigint AS sale_count
      FROM sales
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND EXISTS (
          SELECT 1 FROM sale_lines sl WHERE sl."saleId" = sales."id"
        )
        AND COALESCE("saleDate", "createdAt") >= ${from}
        AND COALESCE("saleDate", "createdAt") <= ${to}
      GROUP BY DATE_TRUNC('month', COALESCE("saleDate", "createdAt"))
      ORDER BY month
    `);

    const monthlyCogs = await prisma.$queryRaw<
      { month: Date; cogs: Decimal }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', COALESCE(s."saleDate", s."createdAt")) AS month,
             COALESCE(SUM(COALESCE(sl."costPriceSnapshot", pv."costPrice") * sl."quantity"), 0) AS cogs
      FROM sale_lines sl
      JOIN sales s ON sl."saleId" = s."id"
      JOIN product_variants pv ON sl."variantId" = pv."id"
      WHERE s."tenantId" = ${tenantId}
        AND s."status" = 'COMPLETED'
        AND COALESCE(s."saleDate", s."createdAt") >= ${from}
        AND COALESCE(s."saleDate", s."createdAt") <= ${to}
      GROUP BY DATE_TRUNC('month', COALESCE(s."saleDate", s."createdAt"))
      ORDER BY month
    `);

    const monthlyReturns = await prisma.$queryRaw<
      { month: Date; returns: Decimal }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', r."createdAt") AS month,
             COALESCE(SUM(
               r."refundAmount" * CASE
                 WHEN s."subtotal" = 0 THEN 1
                 ELSE GREATEST(s."subtotal" - s."discountAmount", 0) / s."subtotal"
               END
             ), 0) AS returns
      FROM returns r
      JOIN sales s ON s."id" = r."originalSaleId"
      WHERE r."tenantId" = ${tenantId}
        AND r."status" = 'COMPLETED'
        AND r."createdAt" >= ${from}
        AND r."createdAt" <= ${to}
      GROUP BY DATE_TRUNC('month', r."createdAt")
      ORDER BY month
    `);

    const monthlyReturnedCogs = await prisma.$queryRaw<
      { month: Date; returned_cogs: Decimal }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', r."createdAt") AS month,
             COALESCE(SUM(COALESCE(sl."costPriceSnapshot", pv."costPrice") * rl."quantity"), 0) AS returned_cogs
      FROM return_lines rl
      JOIN returns r ON rl."returnId" = r."id"
      JOIN sale_lines sl ON sl."id" = rl."originalSaleLineId"
      JOIN product_variants pv ON rl."variantId" = pv."id"
      WHERE r."tenantId" = ${tenantId}
        AND r."status" = 'COMPLETED'
        AND r."createdAt" >= ${from}
        AND r."createdAt" <= ${to}
      GROUP BY DATE_TRUNC('month', r."createdAt")
      ORDER BY month
    `);

    const monthlyExpenses = await prisma.$queryRaw<
      { month: Date; expenses: Decimal }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', "expenseDate") AS month,
             COALESCE(SUM("amount"), 0) AS expenses
      FROM expenses
      WHERE "tenantId" = ${tenantId}
        AND "expenseDate" >= ${from}
        AND "expenseDate" <= ${to}
      GROUP BY DATE_TRUNC('month', "expenseDate")
      ORDER BY month
    `);

    // Merge monthly data
    const monthMap = new Map<
      string,
      {
        revenue: Decimal;
        cogs: Decimal;
        returns: Decimal;
        returnedCogs: Decimal;
        expenses: Decimal;
        saleCount: number;
      }
    >();

    const emptyMonth = () => ({
      revenue: new Decimal(0),
      cogs: new Decimal(0),
      returns: new Decimal(0),
      returnedCogs: new Decimal(0),
      expenses: new Decimal(0),
      saleCount: 0,
    });

    for (const row of monthlyRevenue) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? emptyMonth();
      entry.revenue = new Decimal(row.revenue?.toString() ?? "0");
      entry.saleCount = Number(row.sale_count);
      monthMap.set(key, entry);
    }

    for (const row of monthlyCogs) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? emptyMonth();
      entry.cogs = new Decimal(row.cogs?.toString() ?? "0");
      monthMap.set(key, entry);
    }

    for (const row of monthlyReturns) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? emptyMonth();
      entry.returns = new Decimal(row.returns?.toString() ?? "0");
      monthMap.set(key, entry);
    }

    for (const row of monthlyReturnedCogs) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? emptyMonth();
      entry.returnedCogs = new Decimal(row.returned_cogs?.toString() ?? "0");
      monthMap.set(key, entry);
    }

    for (const row of monthlyExpenses) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? emptyMonth();
      entry.expenses = new Decimal(row.expenses?.toString() ?? "0");
      monthMap.set(key, entry);
    }

    // Keep the monthly detail inside the selected From/To period. The SQL
    // already filters, but this guard prevents a stale/NOW-based row from
    // leaking back in as an unrelated trend (ARGUS #437).
    const monthlyData = filterMonthKeysInPeriod(monthMap.keys(), from, to).map((month) => {
      const d = monthMap.get(month) ?? emptyMonth();
      const netRevenue = d.revenue.minus(d.returns);
      const netCogs = d.cogs.minus(d.returnedCogs);
      const grossProfit = netRevenue.minus(netCogs);
      const netProfit = grossProfit.minus(d.expenses);
      return {
        month,
        revenue: netRevenue.toFixed(2),
        cogs: netCogs.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        expenses: d.expenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        saleCount: d.saleCount,
      };
    });

    // ── Computed totals ──────────────────────────────────────────
    const netRevenue = grossRevenue.minus(totalReturns);
    const netCOGS = rawCOGS.minus(returnedCOGS);
    const grossProfit = netRevenue.minus(netCOGS);
    const netProfit = grossProfit.minus(totalExpenses);

    const grossMargin = netRevenue.isZero()
      ? new Decimal(0)
      : grossProfit.div(netRevenue).times(100);

    const netMargin = netRevenue.isZero()
      ? new Decimal(0)
      : netProfit.div(netRevenue).times(100);

    const cogsQuality = {
      sales: salesCogsSource,
      returned: returnedCogsSource,
      usesFallback:
        salesCogsSource.usesFallback || returnedCogsSource.usesFallback,
      caveats: [
        ...(salesCogsSource.caveat ? [`Sales COGS: ${salesCogsSource.caveat}`] : []),
        ...(returnedCogsSource.caveat
          ? [`Returned COGS: ${returnedCogsSource.caveat}`]
          : []),
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        period: { from: from.toISOString(), to: to.toISOString() },
        grossRevenue: grossRevenue.toFixed(2),
        totalReturns: totalReturns.toFixed(2),
        netRevenue: netRevenue.toFixed(2),
        saleCount,
        returnCount,
        revenueByPaymentMethod,
        rawCOGS: rawCOGS.toFixed(2),
        returnedCOGS: returnedCOGS.toFixed(2),
        netCOGS: netCOGS.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMargin: grossMargin.toFixed(1),
        totalExpenses: totalExpenses.toFixed(2),
        expenseCategories,
        netProfit: netProfit.toFixed(2),
        netMargin: netMargin.toFixed(1),
        cogsQuality,
        monthlyData,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/profit-loss error:", error);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}
