import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { saleAccountingDateWhere, netRefundAmount } from '@/lib/reports/accounting';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';
import { netUnitsSold } from '@/lib/reports/sales-report';

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

    // ── 1. Completed sale lines for the accounting period ────────
    const saleLines = await prisma.saleLine.findMany({
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
        quantity: true,
        lineTotalAfterDiscount: true,
        sale: {
          select: { subtotal: true, discountAmount: true },
        },
      },
      orderBy: [{ saleId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    // ── 2. Return lines processed in the period ──────────────────
    const returnLines = await prisma.returnLine.findMany({
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
    });

    if (saleLines.length === 0 && returnLines.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          totals: {
            totalUnits: 0,
            totalReturnedUnits: 0,
            totalNetUnits: 0,
            grossRevenue: "0.00",
            totalReturns: "0.00",
            netRevenue: "0.00",
          },
        },
      });
    }

    // ── 3. Attribute the cart-level discount to each line ────────
    // `lineTotalAfterDiscount` excludes the cart discount. The POS allocates it
    // proportionally before tax, so the report must do the same or every
    // cart-discounted sale overstates product revenue.
    const linesBySale = new Map<string, typeof saleLines>();
    for (const line of saleLines) {
      const current = linesBySale.get(line.saleId);
      if (current) current.push(line);
      else linesBySale.set(line.saleId, [line]);
    }

    interface VariantSales {
      unitsSold: number;
      grossRevenue: Decimal;
    }
    const salesByVariant = new Map<string, VariantSales>();

    for (const lines of linesBySale.values()) {
      const lineTotals = lines.map(
        (line) => new Decimal(line.lineTotalAfterDiscount.toString()),
      );
      const cartDiscount = new Decimal(
        lines[0]!.sale.discountAmount.toString(),
      );
      const shares = allocateCartDiscountShares(lineTotals, cartDiscount);

      lines.forEach((line, index) => {
        const netLine = lineTotals[index]!.minus(shares[index]!);
        const entry = salesByVariant.get(line.variantId) ?? {
          unitsSold: 0,
          grossRevenue: new Decimal(0),
        };
        entry.unitsSold += line.quantity;
        entry.grossRevenue = entry.grossRevenue.plus(netLine);
        salesByVariant.set(line.variantId, entry);
      });
    }

    // ── 4. Refunds net of the original sale's cart discount ──────
    interface VariantReturns {
      returnedUnits: number;
      refundAmount: Decimal;
    }
    const returnsByVariant = new Map<string, VariantReturns>();

    for (const line of returnLines) {
      const sale = line.return.originalSale;
      const refund = netRefundAmount(
        line.lineRefundAmount,
        sale.subtotal,
        sale.discountAmount,
      );

      const entry = returnsByVariant.get(line.variantId) ?? {
        returnedUnits: 0,
        refundAmount: new Decimal(0),
      };
      entry.returnedUnits += line.quantity;
      entry.refundAmount = entry.refundAmount.plus(refund);
      returnsByVariant.set(line.variantId, entry);
    }

    // ── 5. Fetch variant/product labels for every involved variant ─
    const variantIds = [
      ...new Set([...salesByVariant.keys(), ...returnsByVariant.keys()]),
    ];
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, tenantId },
      select: {
        id: true,
        sku: true,
        form: true,
        packSize: true,
        product: { select: { name: true } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // ── 6. Join sales + returns ──────────────────────────────────
    let grandGross = new Decimal(0);
    let grandReturns = new Decimal(0);
    let grandUnits = 0;
    let grandReturnedUnits = 0;

    const rawProducts = variantIds.map((variantId) => {
      const sale = salesByVariant.get(variantId);
      const ret = returnsByVariant.get(variantId);
      const gross = sale?.grossRevenue ?? new Decimal(0);
      const refund = ret?.refundAmount ?? new Decimal(0);
      const units = sale?.unitsSold ?? 0;
      const returnedUnits = ret?.returnedUnits ?? 0;
      const netUnits = netUnitsSold(units, returnedUnits);

      grandGross = grandGross.plus(gross);
      grandReturns = grandReturns.plus(refund);
      grandUnits += units;
      grandReturnedUnits += returnedUnits;

      const variant = variantMap.get(variantId);
      const variantDesc = [variant?.form, variant?.packSize]
        .filter(Boolean)
        .join(" / ");

      return {
        variantId,
        productName: variant?.product.name ?? "Unknown",
        variantDescription: variantDesc || variant?.sku || "—",
        unitsSold: units,
        returnedUnits,
        netUnits,
        grossRevenue: gross,
        returns: refund,
        netRevenue: gross.minus(refund),
      };
    });

    rawProducts.sort((a, b) => b.netRevenue.minus(a.netRevenue).toNumber());

    const grandNet = grandGross.minus(grandReturns);

    const products = rawProducts.map((p) => ({
      variantId: p.variantId,
      productName: p.productName,
      variantDescription: p.variantDescription,
      unitsSold: p.unitsSold,
      returnedUnits: p.returnedUnits,
      netUnits: p.netUnits,
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
          totalReturnedUnits: grandReturnedUnits,
          totalNetUnits: netUnitsSold(grandUnits, grandReturnedUnits),
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
