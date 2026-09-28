import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getProductById, updateProduct, softDeleteProduct } from '@/lib/services/product.service';
import { UpdateProductSchema } from '@/lib/validators/product.validators';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const product = await getProductById(tenantId, id);

    const canViewCost = hasPermission(session.user, PERMISSIONS.PRODUCT.viewCostPrice);

    const data = canViewCost
      ? product
      : {
          ...product,
          variants: product.variants.map(({ costPrice: _cost, ...rest }) => rest),
        };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'GET /api/store/products/[id]');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT.editProduct)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateProductSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const updated = await updateProduct(tenantId, id, session.user.id, parsed.data);

    // Revalidate so edits (name, price, images, etc.) appear instantly on the storefront.
    try {
      await revalidateTenantStorefront(tenantId, { productIds: [id], catalog: true });
    } catch (revalidateErr) {
      console.warn('[PATCH /api/store/products/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'PATCH /api/store/products/[id]');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT.deleteProduct)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const deleted = await softDeleteProduct(tenantId, id, session.user.id);

    // Revalidate so the archived product disappears from the storefront immediately.
    try {
      await revalidateTenantStorefront(tenantId, { productIds: [id], catalog: true });
    } catch (revalidateErr) {
      console.warn('[DELETE /api/store/products/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({
      success: true,
      data: deleted,
      message: 'Product deleted. It can be restored from the Deleted filter in Inventory.',
    });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'DELETE /api/store/products/[id]');
  }
}
