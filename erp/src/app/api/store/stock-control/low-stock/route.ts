import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';

interface LowStockRow {
  id: string;
  sku: string;
  form: string | null;
  pack_size: string | null;
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

    // XC-03: shared guard replaces the hand-rolled permissions.includes check.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.STOCK.viewStock);
    if (forbidden) return forbidden;

    const { searchParams } = request.nextUrl;
    const countOnly = searchParams.get('countOnly') === 'true';
    const format = searchParams.get('format');
    // XC-01: threshold=abc used to be parseInt→NaN→silent empty 200 (BUG-81)
    // and >int4 crashed with 500 (BUG-82). Now: malformed → 400, clamped to a
    // sane int4 window.
    const threshold = parseQueryInt(searchParams, 'threshold', { min: 0, max: 2_147_483_647 });
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1 }) ?? 1;
    const limit = parseQueryInt(searchParams, 'limit', { default: 25, min: 1, max: 100 }) ?? 25;

    if (countOnly) {
      // M10-01/OBS-78: countOnly used to ignore the threshold override (the list/CSV
      // paths honored it, counts did not). The count now uses the exact same predicate
      // as the list path: the explicit override when supplied, else the per-variant default.
      const result =
        threshold != null
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
          SELECT pv.id, pv.sku, pv.form, pv."packSize" as pack_size,
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
          SELECT pv.id, pv.sku, pv.form, pv."packSize" as pack_size,
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
      const header = 'Product Name,Category,SKU,Form,Pack Size,Current Stock,Threshold,Shortfall,Retail Price';
      const rows = variants.map((v) =>
        [
          `"${v.product_name.replace(/"/g, '""')}"`,
          `"${v.category_name.replace(/"/g, '""')}"`,
          v.sku,
          v.form ?? '',
          v.pack_size ?? '',
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
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'Low stock query');
  }
}
