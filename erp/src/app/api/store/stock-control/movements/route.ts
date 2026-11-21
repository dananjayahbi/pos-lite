import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import type { Prisma } from '@/generated/prisma/client';
import { StockMovementReason } from '@/generated/prisma/client';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt, parseQueryDate } from '@/lib/api/query-params';
import { resolveInclusiveDateRange } from '@/lib/api/inclusive-date-range';
import { neutralizeCsvFormula, toCsvLines } from '@/lib/export';
import { stockMovementReasonLabel } from '@/lib/constants/stock-movement';
import { resolveStockMovementSource } from '@/lib/stock/movement-source';
import {
  formatStockMovementTimestamp,
  stockMovementDisplayTimeZone,
} from '@/lib/stock/movement-timestamp';

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
    // ARGUS #184: validate with the shared parser (garbage still 400s) but
    // build the filter as inclusive local calendar days. `to` used to be UTC
    // midnight, which excluded everything written later that day.
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    parseQueryDate(searchParams, 'from');
    parseQueryDate(searchParams, 'to');
    const { from: fromDate, to: toDate } = resolveInclusiveDateRange(fromParam, toParam);
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
      const [movements, tenant] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          orderBy: { createdAt: sortOrder },
          include,
        }),
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { settings: true },
        }),
      ]);

      // ARGUS #200: render the same local timestamp the page shows. Use the
      // tenant's configured zone when present, otherwise the server zone; the
      // raw UTC instant stays available in its own column.
      const settings = (tenant?.settings ?? {}) as { timezone?: string };
      const displayTimeZone = stockMovementDisplayTimeZone(settings.timezone);

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
          // ARGUS #199: tie each row back to the document that produced it.
          'Source Type',
          'Source ID',
          'Sale ID',
          'Purchase Order ID',
          'Stock Take Session ID',
          'Batch ID',
          'Timestamp (UTC)',
        ],
        movements.map((m) => {
          const source = resolveStockMovementSource(m);
          return [
            formatStockMovementTimestamp(m.createdAt, displayTimeZone),
            // ARGUS #201: product name, SKU, variant text, actor and note are
            // user-entered. A leading = + - @ must not become a formula.
            neutralizeCsvFormula(m.variant.product.name),
            neutralizeCsvFormula(m.variant.sku),
            neutralizeCsvFormula(m.variant.form ?? ''),
            neutralizeCsvFormula(m.variant.packSize ?? ''),
            m.reason,
            stockMovementReasonLabel(m.reason),
            m.quantityDelta > 0 ? `+${m.quantityDelta}` : String(m.quantityDelta),
            String(m.quantityBefore),
            String(m.quantityAfter),
            neutralizeCsvFormula(m.actor?.email ?? 'system'),
            neutralizeCsvFormula(m.note ?? ''),
            source?.label ?? '',
            source?.id ?? '',
            m.saleId ?? '',
            m.purchaseOrderId ?? '',
            m.stockTakeSessionId ?? '',
            m.batchId ?? '',
            m.createdAt.toISOString(),
          ];
        }),
      );

      // Use the caller's calendar labels, not `toISOString()` - a local
      // end-of-day can fall on the previous UTC date.
      const fromStr = fromParam ? fromParam.trim().slice(0, 10) : '';
      const toStr = toParam ? toParam.trim().slice(0, 10) : '';
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
