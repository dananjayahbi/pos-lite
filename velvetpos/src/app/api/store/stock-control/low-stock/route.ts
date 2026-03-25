import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface LowStockRow {
  id: string;
  sku: string;
  size: string | null;
  colour: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  retail_price: string;
  product_name: string;
  category_name: string;
  shortfall: number;
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

    const userPermissions = Array.isArray(session.user.permissions)
      ? session.user.permissions.filter((p): p is string => typeof p === 'string')
      : [];

    if (!userPermissions.includes('stock:view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Missing stock:view permission' } },
        { status: 403 },
      );
    }

    const { searchParams } = request.nextUrl;
    const countOnly = searchParams.get('countOnly') === 'true';
    const format = searchParams.get('format');
    const thresholdParam = searchParams.get('threshold');
    const threshold = thresholdParam ? parseInt(thresholdParam, 10) : null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)));

    if (countOnly) {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM product_variants pv
        JOIN products p ON pv."productId" = p.id
        WHERE pv."tenantId" = ${tenantId}
          AND pv."deletedAt" IS NULL
          AND p."deletedAt" IS NULL
          AND p."isArchived" = false
          AND pv."lowStockThreshold" > 0
          AND pv."stockQuantity" <= pv."lowStockThreshold"
      `;

      return NextResponse.json({
        success: true,
        data: { count: Number(result[0].count) },
      });
    }

    // Count total for pagination
    const countResult = threshold != null
      ? await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM product_variants pv
          JOIN products p ON pv."productId" = p.id
          WHERE pv."tenantId" = ${tenantId}
            AND pv."deletedAt" IS NULL
            AND p."deletedAt" IS NULL
            AND p."isArchived" = false
            AND pv."lowStockThreshold" > 0
            AND pv."stockQuantity" <= ${threshold}
        `
      : await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM product_variants pv
          JOIN products p ON pv."productId" = p.id
          WHERE pv."tenantId" = ${tenantId}
            AND pv."deletedAt" IS NULL
            AND p."deletedAt" IS NULL
            AND p."isArchived" = false
            AND pv."lowStockThreshold" > 0
            AND pv."stockQuantity" <= pv."lowStockThreshold"
        `;

    const total = Number(countResult[0].count);

    // For CSV export, fetch all rows without pagination
    const isCsv = format === 'csv';
    const queryLimit = isCsv ? total : limit;
    const queryOffset = isCsv ? 0 : (page - 1) * limit;

    const variants = threshold != null
      ? await prisma.$queryRaw<LowStockRow[]>`
          SELECT pv.id, pv.sku, pv.size, pv.colour,
            pv."stockQuantity" as stock_quantity, pv."lowStockThreshold" as low_stock_threshold,
            pv."retailPrice"::text as retail_price,
            p.name as product_name, c.name as category_name,
            (${threshold} - pv."stockQuantity") as shortfall
          FROM product_variants pv
          JOIN products p ON pv."productId" = p.id
          JOIN categories c ON p."categoryId" = c.id
          WHERE pv."tenantId" = ${tenantId}
            AND pv."deletedAt" IS NULL
            AND p."deletedAt" IS NULL
            AND p."isArchived" = false
            AND pv."lowStockThreshold" > 0
            AND pv."stockQuantity" <= ${threshold}
          ORDER BY shortfall DESC
          LIMIT ${queryLimit} OFFSET ${queryOffset}
        `
      : await prisma.$queryRaw<LowStockRow[]>`
          SELECT pv.id, pv.sku, pv.size, pv.colour,
            pv."stockQuantity" as stock_quantity, pv."lowStockThreshold" as low_stock_threshold,
            pv."retailPrice"::text as retail_price,
            p.name as product_name, c.name as category_name,
            (pv."lowStockThreshold" - pv."stockQuantity") as shortfall
          FROM product_variants pv
          JOIN products p ON pv."productId" = p.id
          JOIN categories c ON p."categoryId" = c.id
          WHERE pv."tenantId" = ${tenantId}
            AND pv."deletedAt" IS NULL
            AND p."deletedAt" IS NULL
            AND p."isArchived" = false
            AND pv."lowStockThreshold" > 0
            AND pv."stockQuantity" <= pv."lowStockThreshold"
          ORDER BY shortfall DESC
          LIMIT ${queryLimit} OFFSET ${queryOffset}
        `;

    if (isCsv) {
      const today = new Date().toISOString().split('T')[0];
      const header = 'Product Name,Category,SKU,Size,Colour,Current Stock,Threshold,Shortfall,Retail Price';
      const rows = variants.map((v) =>
        [
          `"${v.product_name.replace(/"/g, '""')}"`,
          `"${v.category_name.replace(/"/g, '""')}"`,
          v.sku,
          v.size ?? '',
          v.colour ?? '',
          v.stock_quantity,
          v.low_stock_threshold,
          v.shortfall,
          v.retail_price,
        ].join(','),
      );
      const csv = [header, ...rows].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="low-stock-${today}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: variants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Low stock query error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch low stock data' } },
      { status: 500 },
    );
  }
}
