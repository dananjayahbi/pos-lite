import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, StockMovementReason } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
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
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const variantSearch = url.searchParams.get("variantSearch")?.trim() ?? "";
    const movementType = url.searchParams.get("movementType") ?? "";

    // ── Build where clause ───────────────────────────────────────
    const dateFilter: Prisma.DateTimeFilter | undefined = (() => {
      if (!from && !to) return undefined;
      const f: Prisma.DateTimeFilter = {};
      if (from) f.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        f.lte = end;
      }
      return f;
    })();

    const variantFilter:
      | Prisma.ProductVariantWhereInput
      | undefined = variantSearch
      ? {
          OR: [
            { sku: { contains: variantSearch, mode: "insensitive" as const } },
            {
              product: {
                name: { contains: variantSearch, mode: "insensitive" as const },
              },
            },
          ],
        }
      : undefined;

    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(movementType ? { reason: movementType as StockMovementReason } : {}),
      ...(variantFilter ? { variant: variantFilter } : {}),
    };

    // ── Paginated movements query ────────────────────────────────
    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          variant: {
            include: {
              product: { select: { name: true } },
            },
          },
          actor: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // ── Summary by reason (unfiltered by page) ───────────────────
    const summaryWhere: Prisma.StockMovementWhereInput = { ...where };
    const summary = await prisma.stockMovement.groupBy({
      by: ["reason"],
      where: summaryWhere,
      _sum: { quantityDelta: true },
      _count: { id: true },
    });

    const formattedSummary = summary.map((s) => ({
      reason: s.reason,
      netDelta: s._sum.quantityDelta ?? 0,
      count: s._count.id,
    }));

    const formattedMovements = movements.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      productName: m.variant.product.name,
      sku: m.variant.sku,
      variantId: m.variantId,
      reason: m.reason,
      quantityDelta: m.quantityDelta,
      quantityBefore: m.quantityBefore,
      quantityAfter: m.quantityAfter,
      actorEmail: m.actor.email,
      note: m.note,
      saleId: m.saleId,
      purchaseOrderId: m.purchaseOrderId,
      stockTakeSessionId: m.stockTakeSessionId,
    }));

    return NextResponse.json({
      success: true,
      data: {
        movements: formattedMovements,
        total,
        summary: formattedSummary,
      },
    });
  } catch (error) {
    console.error("Stock movements report error:", error);
    return errorJson("INTERNAL_ERROR", "Failed to generate report", 500);
  }
}
