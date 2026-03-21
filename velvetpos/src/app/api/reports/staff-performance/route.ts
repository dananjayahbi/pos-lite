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

interface TimeClockRow {
  user_id: string;
  total_hours: number | null;
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

    const userRole = session.user.role;

    // RBAC: STOCK_CLERK → 403
    if (userRole === "STOCK_CLERK") {
      return errorJson("FORBIDDEN", "Insufficient permissions", 403);
    }

    const url = request.nextUrl;
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson("BAD_REQUEST", "Invalid date parameters", 400);
    }

    // CASHIER → filter to own data only
    const isCashier = userRole === "CASHIER";
    const userIdFilter = isCashier ? session.user.id : undefined;

    // ── Parallel queries ─────────────────────────────────────────
    const [saleGroups, timeClockRows, commissionGroups, commissionPaidGroups] =
      await Promise.all([
        // a. Sales grouped by cashierId
        prisma.sale.groupBy({
          by: ["cashierId"],
          where: {
            tenantId,
            status: "COMPLETED",
            createdAt: { gte: from, lte: to },
            ...(userIdFilter ? { cashierId: userIdFilter } : {}),
          },
          _sum: { totalAmount: true },
          _count: true,
        }),

        // b. TimeClock hours via $queryRaw
        userIdFilter
          ? prisma.$queryRaw<TimeClockRow[]>(Prisma.sql`
              SELECT "userId" AS user_id,
                     COALESCE(SUM(EXTRACT(EPOCH FROM ("clockedOutAt" - "clockedInAt")) / 3600.0), 0) AS total_hours
              FROM time_clocks
              WHERE "tenantId" = ${tenantId}
                AND "clockedInAt" >= ${from}
                AND "clockedInAt" <= ${to}
                AND "clockedOutAt" IS NOT NULL
                AND "userId" = ${userIdFilter}
              GROUP BY "userId"
            `)
          : prisma.$queryRaw<TimeClockRow[]>(Prisma.sql`
              SELECT "userId" AS user_id,
                     COALESCE(SUM(EXTRACT(EPOCH FROM ("clockedOutAt" - "clockedInAt")) / 3600.0), 0) AS total_hours
              FROM time_clocks
              WHERE "tenantId" = ${tenantId}
                AND "clockedInAt" >= ${from}
                AND "clockedInAt" <= ${to}
                AND "clockedOutAt" IS NOT NULL
              GROUP BY "userId"
            `),

        // c. Commission earned grouped by userId
        prisma.commissionRecord.groupBy({
          by: ["userId"],
          where: {
            tenantId,
            createdAt: { gte: from, lte: to },
            ...(userIdFilter ? { userId: userIdFilter } : {}),
          },
          _sum: { earnedAmount: true },
        }),

        // d. Commission paid grouped by userId
        prisma.commissionRecord.groupBy({
          by: ["userId"],
          where: {
            tenantId,
            createdAt: { gte: from, lte: to },
            isPaid: true,
            ...(userIdFilter ? { userId: userIdFilter } : {}),
          },
          _sum: { earnedAmount: true },
        }),
      ]);

    // ── Collect all involved userIds ─────────────────────────────
    const allUserIds = new Set<string>();
    for (const g of saleGroups) allUserIds.add(g.cashierId);
    for (const r of timeClockRows) allUserIds.add(r.user_id);
    for (const c of commissionGroups) allUserIds.add(c.userId);
    for (const c of commissionPaidGroups) allUserIds.add(c.userId);

    if (allUserIds.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          staff: [],
          totals: {
            totalSalesCount: 0,
            totalRevenue: "0.00",
            totalAov: "0.00",
            totalHoursWorked: "0.00",
            totalCommissionEarned: "0.00",
            totalCommissionPaid: "0.00",
          },
          userRole,
        },
      });
    }

    // ── Fetch User records ───────────────────────────────────────
    const users = await prisma.user.findMany({
      where: { id: { in: [...allUserIds] } },
      select: { id: true, email: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // ── Build lookup maps ────────────────────────────────────────
    const salesMap = new Map(
      saleGroups.map((g) => [
        g.cashierId,
        {
          count: g._count,
          total: new Decimal(g._sum.totalAmount?.toString() ?? "0"),
        },
      ]),
    );

    const hoursMap = new Map(
      timeClockRows.map((r) => [r.user_id, Number(r.total_hours ?? 0)]),
    );

    const commEarnedMap = new Map(
      commissionGroups.map((c) => [
        c.userId,
        new Decimal(c._sum.earnedAmount?.toString() ?? "0"),
      ]),
    );

    const commPaidMap = new Map(
      commissionPaidGroups.map((c) => [
        c.userId,
        new Decimal(c._sum.earnedAmount?.toString() ?? "0"),
      ]),
    );

    // ── Join datasets ────────────────────────────────────────────
    let grandSalesCount = 0;
    let grandRevenue = new Decimal(0);
    let grandHours = 0;
    let grandCommEarned = new Decimal(0);
    let grandCommPaid = new Decimal(0);

    const staffList = [...allUserIds].map((userId) => {
      const user = userMap.get(userId);
      const sale = salesMap.get(userId);
      const salesCount = sale?.count ?? 0;
      const revenue = sale?.total ?? new Decimal(0);
      const aov =
        salesCount > 0 ? revenue.div(salesCount) : new Decimal(0);
      const hoursWorked = hoursMap.get(userId) ?? 0;
      const commEarned = commEarnedMap.get(userId) ?? new Decimal(0);
      const commPaid = commPaidMap.get(userId) ?? new Decimal(0);

      grandSalesCount += salesCount;
      grandRevenue = grandRevenue.plus(revenue);
      grandHours += hoursWorked;
      grandCommEarned = grandCommEarned.plus(commEarned);
      grandCommPaid = grandCommPaid.plus(commPaid);

      return {
        userId,
        email: user?.email ?? "Unknown",
        role: user?.role ?? "CASHIER",
        salesCount,
        revenue: revenue.toFixed(2),
        aov: aov.toFixed(2),
        hoursWorked: hoursWorked.toFixed(2),
        commissionEarned: commEarned.toFixed(2),
        commissionPaid: commPaid.toFixed(2),
      };
    });

    // Sort by revenue desc
    staffList.sort(
      (a, b) => parseFloat(b.revenue) - parseFloat(a.revenue),
    );

    const grandAov =
      grandSalesCount > 0
        ? grandRevenue.div(grandSalesCount)
        : new Decimal(0);

    return NextResponse.json({
      success: true,
      data: {
        staff: staffList,
        totals: {
          totalSalesCount: grandSalesCount,
          totalRevenue: grandRevenue.toFixed(2),
          totalAov: grandAov.toFixed(2),
          totalHoursWorked: grandHours.toFixed(2),
          totalCommissionEarned: grandCommEarned.toFixed(2),
          totalCommissionPaid: grandCommPaid.toFixed(2),
        },
        userRole,
      },
    });
  } catch (error) {
    console.error("Staff performance report error:", error);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}
