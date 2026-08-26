import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getVariantById } from '@/lib/services/product.service';

/**
 * GET /api/store/stock-control/variant-lookup?variantId=...
 *
 * Resolves a single variant together with its parent product so the
 * Stock Adjustment form can be pre-filled (and locked) when arriving
 * from a Low Stock record.
 */
export async function GET(request: Request) {
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

    if (!userPermissions.includes(PERMISSIONS.STOCK.adjustStock)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Missing stock:adjust permission' } },
        { status: 403 },
      );
    }

    const variantId = new URL(request.url).searchParams.get('variantId');
    if (!variantId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'variantId is required' } },
        { status: 400 },
      );
    }

    const variant = await getVariantById(tenantId, variantId);

    return NextResponse.json({
      success: true,
      data: {
        variant: {
          id: variant.id,
          sku: variant.sku,
          barcode: variant.barcode,
          form: variant.form,
          packSize: variant.packSize,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          costPrice: String(variant.costPrice),
          retailPrice: String(variant.retailPrice),
        },
        product: {
          id: variant.product.id,
          name: variant.product.name,
          categoryId: variant.product.categoryId,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    console.error('GET /api/store/stock-control/variant-lookup error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
