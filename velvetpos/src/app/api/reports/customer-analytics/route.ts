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

interface NewVsReturningRow {
  weekStart: Date;
  newCount: number;
  returningCount: number;
}

interface ChurnRiskRow {
  id: string;
  name: string;
  phone: string;
  lifetimeSpend: Decimal;
  lastPurchaseDate: Date;
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

    const userRole = session.user.role;

    // ── Churn cutoffs ────────────────────────────────────────────
    const cutoff60 = new Date(to);
    cutoff60.setDate(cutoff60.getDate() - 60);
    const cutoff365 = new Date(to);
    cutoff365.setDate(cutoff365.getDate() - 365);

    // ── 3 parallel queries ───────────────────────────────────────
    const [saleGroups, newVsReturningRows, churnRiskRows] = await Promise.all([
      // a. Top customers — groupBy customerId
      prisma.sale.groupBy({
        by: ["customerId"],
        where: {
          tenantId,
          status: "COMPLETED",
          customerId: { not: null },
          createdAt: { gte: from, lte: to },
        },
        _sum: { totalAmount: true },
        _count: true,
        _max: { createdAt: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 50,
      }),

      // b. New vs Returning by week
      prisma.$queryRaw<NewVsReturningRow[]>(Prisma.sql`
        WITH first_sales AS (
          SELECT "customerId", MIN("createdAt") AS first_sale_date
          FROM sales
          WHERE "tenantId" = ${tenantId}
            AND status = 'COMPLETED'
            AND "customerId" IS NOT NULL
          GROUP BY "customerId"
        ),
        weekly_customers AS (
          SELECT DISTINCT s."customerId",
            date_trunc('week', s."createdAt") AS week_start
          FROM sales s
          WHERE s."tenantId" = ${tenantId}
            AND s.status = 'COMPLETED'
            AND s."customerId" IS NOT NULL
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
        )
        SELECT
          wc.week_start AS "weekStart",
          COUNT(DISTINCT CASE
            WHEN date_trunc('week', fs.first_sale_date) = wc.week_start
            THEN wc."customerId"
          END)::int AS "newCount",
          COUNT(DISTINCT CASE
            WHEN date_trunc('week', fs.first_sale_date) < wc.week_start
            THEN wc."customerId"
          END)::int AS "returningCount"
        FROM weekly_customers wc
        JOIN first_sales fs ON fs."customerId" = wc."customerId"
        GROUP BY wc.week_start
        ORDER BY wc.week_start
      `),

      // c. Churn risk — customers with last sale 60–365 days before `to`
      prisma.$queryRaw<ChurnRiskRow[]>(Prisma.sql`
        SELECT
          c.id,
          c.name,
          c.phone,
          c."totalSpend" AS "lifetimeSpend",
          MAX(s."createdAt") AS "lastPurchaseDate"
        FROM customers c
        JOIN sales s ON s."customerId" = c.id AND s."tenantId" = c."tenantId"
        WHERE c."tenantId" = ${tenantId}
          AND s.status = 'COMPLETED'
          AND c."deletedAt" IS NULL
        GROUP BY c.id, c.name, c.phone, c."totalSpend"
        HAVING MAX(s."createdAt") <= ${cutoff60}
           AND MAX(s."createdAt") >= ${cutoff365}
        ORDER BY MAX(s."createdAt") ASC
      `),
    ]);

    // ── Build top customers ──────────────────────────────────────
    const customerIds = saleGroups
      .map((g) => g.customerId)
      .filter((id): id is string => id !== null);

    const customers =
      customerIds.length > 0
        ? await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true, phone: true },
          })
        : [];

    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const topCustomers = saleGroups
      .filter((g): g is typeof g & { customerId: string } => g.customerId !== null)
      .map((g, idx) => {
        const cust = customerMap.get(g.customerId);
        const totalSpend = new Decimal(g._sum.totalAmount?.toString() ?? "0");
        const orderCount = g._count;
        const aov =
          orderCount > 0 ? totalSpend.div(orderCount).toFixed(2) : "0.00";
        return {
          rank: idx + 1,
          customerId: g.customerId,
          name: cust?.name ?? "Unknown",
          phone: cust?.phone ?? "",
          totalOrders: orderCount,
          totalSpend: totalSpend.toFixed(2),
          aov,
          lastVisit: g._max.createdAt?.toISOString() ?? null,
        };
      });

    // ── Format new vs returning ──────────────────────────────────
    const newVsReturning = newVsReturningRows.map((r) => {
      const d = new Date(r.weekStart);
      const month = d.toLocaleString("en-US", { month: "short" });
      const day = d.getDate();
      return {
        week: d.toISOString(),
        label: `${month} ${day}`,
        newCount: Number(r.newCount),
        returningCount: Number(r.returningCount),
      };
    });

    // ── Format churn risk ────────────────────────────────────────
    const churnRisk = churnRiskRows.map((r) => {
      const lastDate = new Date(r.lastPurchaseDate);
      const daysSince = Math.floor(
        (to.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        lastPurchaseDate: lastDate.toISOString(),
        daysSince,
        lifetimeSpend: new Decimal(r.lifetimeSpend?.toString() ?? "0").toFixed(
          2,
        ),
      };
    });

    return NextResponse.json({
      success: true,
      data: { topCustomers, newVsReturning, churnRisk, userRole },
    });
  } catch (err) {
    console.error("[customer-analytics] Error:", err);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}
