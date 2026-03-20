import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import type { Prisma } from '@/generated/prisma/client';
import { StockMovementReason } from '@/generated/prisma/client';

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

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '25')));
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const reasonsParam = searchParams.get('reasons');
    const search = searchParams.get('search');
    const actorId = searchParams.get('actorId');
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const format = searchParams.get('format');

    // Build where clause
    const where: Prisma.StockMovementWhereInput = { tenantId };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
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
          size: true,
          colour: true,
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

      const header = 'Date,Product,SKU,Size,Colour,Reason,Reason Label,Change,Before,After,Actor,Note';
      const rows = movements.map((m) => {
        const date = m.createdAt.toISOString();
        const product = escapeCSV(m.variant.product.name);
        const sku = escapeCSV(m.variant.sku);
        const size = escapeCSV(m.variant.size ?? '');
        const colour = escapeCSV(m.variant.colour ?? '');
        const reason = m.reason;
        const reasonLabel = escapeCSV(REASON_LABELS[m.reason] ?? m.reason);
        const change = m.quantityDelta > 0 ? `+${m.quantityDelta}` : String(m.quantityDelta);
        const before = String(m.quantityBefore);
        const after = String(m.quantityAfter);
        const actor = escapeCSV(m.actor.email);
        const note = escapeCSV(m.note ?? '');
        return `${date},${product},${sku},${size},${colour},${reason},${reasonLabel},${change},${before},${after},${actor},${note}`;
      });

      const csv = [header, ...rows].join('\n');

      const fromStr = from ?? '';
      const toStr = to ?? '';
      const filename = from || to
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
    console.error('Stock movements error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock movements' } },
      { status: 500 },
    );
  }
}
