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

    // ── 1. Revenue: completed sales aggregate ────────────────────
    const revenueAgg = await prisma.sale.aggregate({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const grossRevenue = new Decimal(
      revenueAgg._sum.totalAmount?.toString() ?? "0",
    );
    const saleCount = revenueAgg._count;

    // ── 2. Returns: completed returns aggregate ──────────────────
    const returnAgg = await prisma.return.aggregate({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      _sum: { refundAmount: true },
      _count: true,
    });

    const totalReturns = new Decimal(
      returnAgg._sum.refundAmount?.toString() ?? "0",
    );
    const returnCount = returnAgg._count;

    // ── 3. Revenue by payment method ─────────────────────────────
    const revenueByMethod = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      _sum: { totalAmount: true },
    });

    const revenueByPaymentMethod = revenueByMethod.map((r) => ({
      method: r.paymentMethod ?? "UNKNOWN",
      total: new Decimal(r._sum.totalAmount?.toString() ?? "0").toFixed(2),
    }));

    // ── 4. COGS: join sale_lines → product_variants for costPrice ─
    const cogsResult = await prisma.$queryRaw<
      { total_cogs: Decimal | null }[]
    >(Prisma.sql`
      SELECT COALESCE(SUM(pv."costPrice" * sl."quantity"), 0) AS total_cogs
      FROM sale_lines sl
      JOIN sales s ON sl."saleId" = s."id"
      JOIN product_variants pv ON sl."variantId" = pv."id"
      WHERE s."tenantId" = ${tenantId}
        AND s."status" = 'COMPLETED'
        AND s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
    `);

    const rawCOGS = new Decimal(cogsResult[0]?.total_cogs?.toString() ?? "0");

    // ── 5. Returned COGS ─────────────────────────────────────────
    const returnedCogsResult = await prisma.$queryRaw<
      { total_cogs: Decimal | null }[]
    >(Prisma.sql`
      SELECT COALESCE(SUM(pv."costPrice" * rl."quantity"), 0) AS total_cogs
      FROM return_lines rl
      JOIN returns r ON rl."returnId" = r."id"
      JOIN product_variants pv ON rl."variantId" = pv."id"
      WHERE r."tenantId" = ${tenantId}
        AND r."status" = 'COMPLETED'
        AND r."createdAt" >= ${from}
        AND r."createdAt" <= ${to}
    `);

    const returnedCOGS = new Decimal(
      returnedCogsResult[0]?.total_cogs?.toString() ?? "0",
    );

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
    const monthlyRevenue = await prisma.$queryRaw<
      { month: Date; revenue: Decimal; sale_count: bigint }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', "createdAt") AS month,
             COALESCE(SUM("totalAmount"), 0) AS revenue,
             COUNT(*)::bigint AS sale_count
      FROM sales
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month
    `);

    const monthlyCogs = await prisma.$queryRaw<
      { month: Date; cogs: Decimal }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', s."createdAt") AS month,
             COALESCE(SUM(pv."costPrice" * sl."quantity"), 0) AS cogs
      FROM sale_lines sl
      JOIN sales s ON sl."saleId" = s."id"
      JOIN product_variants pv ON sl."variantId" = pv."id"
      WHERE s."tenantId" = ${tenantId}
        AND s."status" = 'COMPLETED'
        AND s."createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', s."createdAt")
      ORDER BY month
    `);

    const monthlyExpenses = await prisma.$queryRaw<
      { month: Date; expenses: Decimal }[]
    >(Prisma.sql`
      SELECT DATE_TRUNC('month', "expenseDate") AS month,
             COALESCE(SUM("amount"), 0) AS expenses
      FROM expenses
      WHERE "tenantId" = ${tenantId}
        AND "expenseDate" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "expenseDate")
      ORDER BY month
    `);

    // Merge monthly data
    const monthMap = new Map<
      string,
      { revenue: Decimal; cogs: Decimal; expenses: Decimal; saleCount: number }
    >();

    for (const row of monthlyRevenue) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? {
        revenue: new Decimal(0),
        cogs: new Decimal(0),
        expenses: new Decimal(0),
        saleCount: 0,
      };
      entry.revenue = new Decimal(row.revenue?.toString() ?? "0");
      entry.saleCount = Number(row.sale_count);
      monthMap.set(key, entry);
    }

    for (const row of monthlyCogs) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? {
        revenue: new Decimal(0),
        cogs: new Decimal(0),
        expenses: new Decimal(0),
        saleCount: 0,
      };
      entry.cogs = new Decimal(row.cogs?.toString() ?? "0");
      monthMap.set(key, entry);
    }

    for (const row of monthlyExpenses) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      const entry = monthMap.get(key) ?? {
        revenue: new Decimal(0),
        cogs: new Decimal(0),
        expenses: new Decimal(0),
        saleCount: 0,
      };
      entry.expenses = new Decimal(row.expenses?.toString() ?? "0");
      monthMap.set(key, entry);
    }

    const monthlyData = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => {
        const grossProfit = d.revenue.minus(d.cogs);
        const netProfit = grossProfit.minus(d.expenses);
        return {
          month,
          revenue: d.revenue.toFixed(2),
          cogs: d.cogs.toFixed(2),
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
        monthlyData,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/profit-loss error:", error);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}
