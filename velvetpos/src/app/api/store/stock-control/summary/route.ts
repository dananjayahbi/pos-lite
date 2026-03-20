import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

    const [totalProducts, lowStockResult, pendingStockTakes, stockValueResult] =
      await Promise.all([
        prisma.product.count({
          where: { tenantId, deletedAt: null, isArchived: false },
        }),

        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM product_variants
          WHERE tenant_id = ${tenantId}
            AND deleted_at IS NULL
            AND stock_quantity <= low_stock_threshold
        `,

        prisma.stockTakeSession.count({
          where: { tenantId, status: 'PENDING_APPROVAL' },
        }),

        prisma.$queryRaw<[{ total: string | null }]>`
          SELECT SUM(stock_quantity * retail_price) as total
          FROM product_variants
          WHERE tenant_id = ${tenantId}
            AND deleted_at IS NULL
        `,
      ]);

    const lowStockVariants = Number(lowStockResult[0].count);

    const canViewStockValue = userPermissions.includes('product:view_cost_price');
    const totalStockValue = canViewStockValue
      ? Number(stockValueResult[0].total ?? 0)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        totalProducts,
        lowStockVariants,
        pendingStockTakes,
        totalStockValue,
      },
    });
  } catch (error) {
    console.error('Stock summary error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock summary' } },
      { status: 500 },
    );
  }
}
