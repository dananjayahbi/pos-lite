import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import type { Prisma } from '@/generated/prisma/client';
import { StockMovementReason } from '@/generated/prisma/client';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt, parseQueryDate } from '@/lib/api/query-params';
import { toCsvLines } from '@/lib/export';

const REASON_LABELS: Record<string, string> = {
  FOUND: 'Found',
  DAMAGED: 'Damaged',
  STOLEN: 'Stolen or Lost',
  DATA_ERROR: 'Data Entry Correction',
  RETURNED_TO_SUPPLIER: 'Returned to Supplier',
  INITIAL_STOCK: 'Initial Stock Entry',
  SALE_RETURN: 'Customer Return',
  PURCHASE_RECEIVED: 'Received from Purchase',
  STOCK_TAKE_ADJUSTMENT: 'Stock Take Adjustment',
};

const VALID_REASONS = new Set(Object.values(StockMovementReason));

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    if (!hasPermission(session.user, PERMISSIONS.STOCK.viewStock)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = request.nextUrl;
    // XC-01: malformed page/limit → 400 (was NaN past the clamp); from/to are
    // now validated ISO dates — garbage no longer reaches Prisma (BUG-40).
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1 }) ?? 1;
    const limit = parseQueryInt(searchParams, 'limit', { default: 25, min: 1, max: 100 }) ?? 25;
    const fromDate = parseQueryDate(searchParams, 'from');
    const toDate = parseQueryDate(searchParams, 'to');
    const reasonsParam = searchParams.get('reasons');
    const search = searchParams.get('search');
    const actorId = searchParams.get('actorId');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const format = searchParams.get('format');

    // Build where clause
    const where: Prisma.StockMovementWhereInput = { tenantId };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (reasonsParam) {
      const reasons = reasonsParam
        .split(',')
        .filter((r): r is StockMovementReason => VALID_REASONS.has(r as StockMovementReason));
      if (reasons.length > 0) {
        where.reason = { in: reasons };
      }
    }

    if (search) {
      where.variant = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    if (actorId) {
      where.actorId = actorId;
    }

    const include = {
      variant: {
        select: {
          sku: true,
          form: true,
          packSize: true,
          lowStockThreshold: true,
          product: {
            select: {
              id: true,
              name: true,
              category: { select: { name: true } },
            },
          },
        },
      },
      actor: { select: { id: true, email: true } },
    };

    // CSV export
    if (format === 'csv') {
      const movements = await prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        include,
      });

      // M35-01 (BUG-79): shared writer + unquoted header. The local `escapeCSV`
      // helper is gone so this route cannot drift from the other exports.
      const csv = toCsvLines(
        [
          'Date',
          'Product',
          'SKU',
          'Form',
          'Pack Size',
          'Reason',
          'Reason Label',
          'Change',
          'Before',
          'After',
          'Actor',
          'Note',
        ],
        movements.map((m) => [
          m.createdAt.toISOString(),
          m.variant.product.name,
          m.variant.sku,
          m.variant.form ?? '',
          m.variant.packSize ?? '',
          m.reason,
          REASON_LABELS[m.reason] ?? m.reason,
          m.quantityDelta > 0 ? `+${m.quantityDelta}` : String(m.quantityDelta),
          String(m.quantityBefore),
          String(m.quantityAfter),
          m.actor?.email ?? 'system',
          m.note ?? '',
        ]),
      );

      const fromStr = fromDate ? fromDate.toISOString().slice(0, 10) : '';
      const toStr = toDate ? toDate.toISOString().slice(0, 10) : '';
      const filename = fromDate || toDate
        ? `stock-movements-${fromStr}-to-${toStr}.csv`
        : 'stock-movements-all.csv';

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Paginated JSON response
    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'Stock movements');
  }
}
