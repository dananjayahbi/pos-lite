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

    // ── 1. SaleLine groupBy variantId for COMPLETED sales ────────
    const saleLineGroups = await prisma.saleLine.groupBy({
      by: ["variantId"],
      where: {
        sale: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
      },
      _sum: { lineTotalAfterDiscount: true, quantity: true },
    });

    if (saleLineGroups.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          totals: {
            totalUnits: 0,
            grossRevenue: "0.00",
            totalReturns: "0.00",
            netRevenue: "0.00",
          },
        },
      });
    }

    const variantIds = saleLineGroups.map((g) => g.variantId);

    // ── 2. Fetch ProductVariant + Product names ──────────────────
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        size: true,
        colour: true,
        product: { select: { name: true } },
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // ── 3. ReturnLine groupBy variantId for refund amounts ───────
    const returnLineGroups = await prisma.returnLine.groupBy({
      by: ["variantId"],
      where: {
        return: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
      },
      _sum: { lineRefundAmount: true, quantity: true },
    });

    const returnMap = new Map(
      returnLineGroups.map((r) => [
        r.variantId,
        {
          refundAmount: new Decimal(
            r._sum.lineRefundAmount?.toString() ?? "0",
          ),
          returnedUnits: r._sum.quantity ?? 0,
        },
      ]),
    );

    // ── 4. Compute per-product data ──────────────────────────────
    let grandGross = new Decimal(0);
    let grandReturns = new Decimal(0);
    let grandUnits = 0;

    const rawProducts = saleLineGroups.map((g) => {
      const gross = new Decimal(
        g._sum.lineTotalAfterDiscount?.toString() ?? "0",
      );
      const units = g._sum.quantity ?? 0;
      const ret = returnMap.get(g.variantId);
      const refund = ret?.refundAmount ?? new Decimal(0);
      const net = gross.minus(refund);

      grandGross = grandGross.plus(gross);
      grandReturns = grandReturns.plus(refund);
      grandUnits += units;

      const variant = variantMap.get(g.variantId);
      const variantDesc = [variant?.size, variant?.colour]
        .filter(Boolean)
        .join(" / ");

      return {
        variantId: g.variantId,
        productName: variant?.product.name ?? "Unknown",
        variantDescription: variantDesc || variant?.sku || "—",
        unitsSold: units,
        grossRevenue: gross,
        returns: refund,
        netRevenue: net,
      };
    });

    // Sort by net revenue desc
    rawProducts.sort((a, b) => b.netRevenue.minus(a.netRevenue).toNumber());

    const grandNet = grandGross.minus(grandReturns);

    const products = rawProducts.map((p) => ({
      variantId: p.variantId,
      productName: p.productName,
      variantDescription: p.variantDescription,
      unitsSold: p.unitsSold,
      grossRevenue: p.grossRevenue.toFixed(2),
      returns: p.returns.toFixed(2),
      netRevenue: p.netRevenue.toFixed(2),
      pctOfTotal: grandNet.isZero()
        ? "0.00"
        : p.netRevenue.div(grandNet).mul(100).toFixed(2),
    }));

    return NextResponse.json({
      success: true,
      data: {
        products,
        totals: {
          totalUnits: grandUnits,
          grossRevenue: grandGross.toFixed(2),
          totalReturns: grandReturns.toFixed(2),
          netRevenue: grandNet.toFixed(2),
        },
      },
    });
  } catch (err) {
    console.error("[sales-report]", err);
    return errorJson("INTERNAL", "Failed to generate report", 500);
  }
}
