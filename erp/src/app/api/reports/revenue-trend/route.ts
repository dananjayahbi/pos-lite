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

type GranularityUnit = "day" | "week" | "month";

const VALID_GRANULARITIES = new Set<GranularityUnit>(["day", "week", "month"]);

function isValidGranularity(v: string): v is GranularityUnit {
  return VALID_GRANULARITIES.has(v as GranularityUnit);
}

function buildRevenueSql(
  granularity: GranularityUnit,
  tenantId: string,
  from: Date,
  to: Date,
) {
  if (granularity === "week") {
    return Prisma.sql`
      SELECT DATE_TRUNC('week', "createdAt") AS bucket,
             COALESCE(SUM("totalAmount"), 0) AS revenue,
             COUNT(*)::bigint AS sale_count
      FROM sales
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY bucket
    `;
  }
  if (granularity === "month") {
    return Prisma.sql`
      SELECT DATE_TRUNC('month', "createdAt") AS bucket,
             COALESCE(SUM("totalAmount"), 0) AS revenue,
             COUNT(*)::bigint AS sale_count
      FROM sales
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY bucket
    `;
  }
  // default: day
  return Prisma.sql`
    SELECT DATE_TRUNC('day', "createdAt") AS bucket,
           COALESCE(SUM("totalAmount"), 0) AS revenue,
           COUNT(*)::bigint AS sale_count
    FROM sales
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'COMPLETED'
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY bucket
  `;
}

function buildReturnsSql(
  granularity: GranularityUnit,
  tenantId: string,
  from: Date,
  to: Date,
) {
  if (granularity === "week") {
    return Prisma.sql`
      SELECT DATE_TRUNC('week', "createdAt") AS bucket,
             COALESCE(SUM("refundAmount"), 0) AS refunds,
             COUNT(*)::bigint AS return_count
      FROM returns
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY bucket
    `;
  }
  if (granularity === "month") {
    return Prisma.sql`
      SELECT DATE_TRUNC('month', "createdAt") AS bucket,
             COALESCE(SUM("refundAmount"), 0) AS refunds,
             COUNT(*)::bigint AS return_count
      FROM returns
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY bucket
    `;
  }
  return Prisma.sql`
    SELECT DATE_TRUNC('day', "createdAt") AS bucket,
           COALESCE(SUM("refundAmount"), 0) AS refunds,
           COUNT(*)::bigint AS return_count
    FROM returns
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'COMPLETED'
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY bucket
  `;
}

interface RevenueRow {
  bucket: Date;
  revenue: Decimal;
  sale_count: bigint;
}

interface ReturnRow {
  bucket: Date;
  refunds: Decimal;
  return_count: bigint;
}

interface PeakHourRow {
  hour: number;
  revenue: Decimal;
  sale_count: bigint;
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
    const granParam = url.searchParams.get("granularity") ?? "daily";

    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson("BAD_REQUEST", "Invalid date parameters", 400);
    }

    const granMap: Record<string, GranularityUnit> = {
      daily: "day",
      weekly: "week",
      monthly: "month",
    };
    const granularity = granMap[granParam] ?? "day";
    if (!isValidGranularity(granularity)) {
      return errorJson("BAD_REQUEST", "Invalid granularity", 400);
    }

    // ── 1. Time-series revenue ───────────────────────────────────
    const revenueRows = await prisma.$queryRaw<RevenueRow[]>(
      buildRevenueSql(granularity, tenantId, from, to),
    );

    // ── 2. Time-series returns ───────────────────────────────────
    const returnRows = await prisma.$queryRaw<ReturnRow[]>(
      buildReturnsSql(granularity, tenantId, from, to),
    );

    // ── 3. Peak hours ────────────────────────────────────────────
    const peakHourRows = await prisma.$queryRaw<PeakHourRow[]>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour,
             COALESCE(SUM("totalAmount"), 0) AS revenue,
             COUNT(*)::bigint AS sale_count
      FROM sales
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `);

    // ── 4. Merge revenue + returns by bucket ─────────────────────
    const bucketMap = new Map<
      string,
      { date: string; revenue: string; returns: string; transactions: number }
    >();

    for (const row of revenueRows) {
      const key = new Date(row.bucket).toISOString();
      bucketMap.set(key, {
        date: key,
        revenue: new Decimal(row.revenue.toString()).toFixed(2),
        returns: "0.00",
        transactions: Number(row.sale_count),
      });
    }

    for (const row of returnRows) {
      const key = new Date(row.bucket).toISOString();
      const existing = bucketMap.get(key);
      if (existing) {
        existing.returns = new Decimal(row.refunds.toString()).toFixed(2);
      } else {
        bucketMap.set(key, {
          date: key,
          revenue: "0.00",
          returns: new Decimal(row.refunds.toString()).toFixed(2),
          transactions: 0,
        });
      }
    }

    const timeSeries = Array.from(bucketMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // ── 5. Format peak hours (fill 0-23) ─────────────────────────
    const peakHourMap = new Map<number, { revenue: string; count: number }>();
    for (const row of peakHourRows) {
      peakHourMap.set(row.hour, {
        revenue: new Decimal(row.revenue.toString()).toFixed(2),
        count: Number(row.sale_count),
      });
    }

    const peakHours = Array.from({ length: 24 }, (_, h) => {
      const entry = peakHourMap.get(h);
      return {
        hour: h,
        revenue: entry?.revenue ?? "0.00",
        count: entry?.count ?? 0,
      };
    });

    // ── 6. Compute stats ─────────────────────────────────────────
    let totalRevenue = new Decimal(0);
    let totalTransactions = 0;
    let totalReturnsAmount = new Decimal(0);

    for (const row of timeSeries) {
      totalRevenue = totalRevenue.plus(row.revenue);
      totalTransactions += row.transactions;
      totalReturnsAmount = totalReturnsAmount.plus(row.returns);
    }

    const avgOrderValue =
      totalTransactions > 0
        ? totalRevenue.div(totalTransactions).toFixed(2)
        : "0.00";

    const returnRate = totalRevenue.gt(0)
      ? totalReturnsAmount.div(totalRevenue).times(100).toFixed(2)
      : "0.00";

    return NextResponse.json({
      success: true,
      data: {
        timeSeries,
        peakHours,
        stats: {
          totalRevenue: totalRevenue.toFixed(2),
          totalTransactions,
          avgOrderValue,
          returnRate,
        },
      },
    });
  } catch (error) {
    console.error("[revenue-trend] Error:", error);
    return errorJson("INTERNAL", "Failed to fetch revenue trend data", 500);
  }
}
