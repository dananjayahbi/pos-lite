import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    // ── 1. Sale groupBy cashierId for COMPLETED sales ────────────
    const saleGroups = await prisma.sale.groupBy({
      by: ["cashierId"],
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    if (saleGroups.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          staff: [],
          totals: {
            totalTransactions: 0,
            totalRevenue: "0.00",
            avgTransactionValue: "0.00",
            totalCommission: "0.00",
          },
        },
      });
    }

    const cashierIds = saleGroups.map((g) => g.cashierId);

    // ── 2. Fetch User info ───────────────────────────────────────
    const users = await prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, email: true, role: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // ── 3. Commission groupBy userId ─────────────────────────────
    const commissionGroups = await prisma.commissionRecord.groupBy({
      by: ["userId"],
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
        userId: { in: cashierIds },
      },
      _sum: { earnedAmount: true },
    });

    const commissionMap = new Map(
      commissionGroups.map((c) => [
        c.userId,
        new Decimal(c._sum.earnedAmount?.toString() ?? "0"),
      ]),
    );

    // ── 4. Compute per-staff data ────────────────────────────────
    let grandTransactions = 0;
    let grandRevenue = new Decimal(0);
    let grandCommission = new Decimal(0);

    const rawStaff = saleGroups.map((g) => {
      const revenue = new Decimal(g._sum.totalAmount?.toString() ?? "0");
      const count = g._count;
      const avg = count > 0 ? revenue.div(count) : new Decimal(0);
      const commission = commissionMap.get(g.cashierId) ?? new Decimal(0);

      grandTransactions += count;
      grandRevenue = grandRevenue.plus(revenue);
      grandCommission = grandCommission.plus(commission);

      const user = userMap.get(g.cashierId);

      return {
        cashierId: g.cashierId,
        staffName: user?.email ?? "Unknown",
        role: user?.role ?? "CASHIER",
        transactions: count,
        totalRevenue: revenue,
        avgTransactionValue: avg,
        commissionEarned: commission,
      };
    });

    // Sort by total revenue desc
    rawStaff.sort((a, b) => b.totalRevenue.minus(a.totalRevenue).toNumber());

    const grandAvg =
      grandTransactions > 0
        ? grandRevenue.div(grandTransactions)
        : new Decimal(0);

    const staff = rawStaff.map((s) => ({
      cashierId: s.cashierId,
      staffName: s.staffName,
      role: s.role,
      transactions: s.transactions,
      totalRevenue: s.totalRevenue.toFixed(2),
      avgTransactionValue: s.avgTransactionValue.toFixed(2),
      commissionEarned: s.commissionEarned.toFixed(2),
    }));

    return NextResponse.json({
      success: true,
      data: {
        staff,
        totals: {
          totalTransactions: grandTransactions,
          totalRevenue: grandRevenue.toFixed(2),
          avgTransactionValue: grandAvg.toFixed(2),
          totalCommission: grandCommission.toFixed(2),
        },
      },
    });
  } catch (err) {
    console.error("[sales-by-staff-report]", err);
    return errorJson("INTERNAL", "Failed to generate report", 500);
  }
}
