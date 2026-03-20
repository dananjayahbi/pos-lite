import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getVariantByBarcode } from '@/lib/services/product.service';

const BARCODE_PATTERN = /^[a-zA-Z0-9-]{8,20}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ barcode: string }> },
) {
  const startTime = performance.now();

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

    const { barcode } = await params;

    if (!BARCODE_PATTERN.test(barcode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid barcode format' } },
        { status: 400 },
      );
    }

    const variant = await getVariantByBarcode(tenantId, barcode);

    const elapsed = Math.round(performance.now() - startTime);

    if (!variant) {
      console.log(`[barcode-lookup] barcode=${barcode} result=miss elapsed=${elapsed}ms`);
      return NextResponse.json(
        { success: false, error: { code: 'BARCODE_NOT_FOUND', message: 'The scanned barcode does not match any product in the system' } },
        { status: 404 },
      );
    }

    console.log(`[barcode-lookup] barcode=${barcode} result=hit elapsed=${elapsed}ms`);

    const canViewCost = hasPermission(session.user, PERMISSIONS.PRODUCT.viewCostPrice);

    const {
      product,
      costPrice: _cost,
      ...variantFields
    } = variant;

    const data = {
      ...variantFields,
      ...(canViewCost ? { costPrice: variant.costPrice } : {}),
      productId: product.id,
      productName: product.name,
      gender: product.gender,
      taxRule: product.taxRule,
      categoryId: product.categoryId,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/store/variants/barcode/[barcode] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
