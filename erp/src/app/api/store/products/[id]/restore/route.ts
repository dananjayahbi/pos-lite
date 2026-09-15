import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { restoreProduct } from '@/lib/services/product.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';

/**
 * M02-03 (BUG-20) — POST /api/store/products/[id]/restore
 *
 * The recovery path promised by the DELETE (soft-delete) response: clears
 * `deletedAt` on the product and its variants. Permission-gated exactly like
 * the sibling archive route (`product:archive`), tenant-scoped via the
 * session, and audited as PRODUCT_RESTORED with the real actor.
 *
 * Errors: 404 when the product doesn't exist (or belongs to another tenant);
 * 409 when it isn't deleted (idempotency guard) or when a variant SKU now
 * collides with a live product (D4: SKUs are reserved after soft-delete).
 */
export async function POST(
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

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT.archiveProduct)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const restored = await restoreProduct(tenantId, id, {
      id: session.user.id,
      role: session.user.role,
    });

    // Revalidate so the restored product reappears on the storefront immediately.
    try {
      await revalidateTenantStorefront(tenantId, { productIds: [id], catalog: true });
    } catch (revalidateErr) {
      console.warn('[POST /api/store/products/[id]/restore] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({
      success: true,
      data: restored,
      message: 'Product restored',
    });
  } catch (error) {
    // INF-02: ApiError 404/409 pass through with their code/message; unknown
    // errors become a generic 500 with no internals.
    return toErrorResponse(error, 'POST /api/store/products/[id]/restore');
  }
}
