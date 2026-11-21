import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { restoreCategory } from '@/lib/services/product.service';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * ARGUS #172 — POST /api/store/categories/[id]/restore
 *
 * The recovery path for a soft-deleted category. Permission-gated like delete
 * (the same role that may remove a category may bring it back), tenant-scoped
 * through the session and audited as CATEGORY_RESTORED.
 *
 * Errors: 404 when the category is missing or belongs to another tenant; 409
 * when it is already live (stale UI signal).
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

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT.deleteProduct)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const restored = await restoreCategory(tenantId, id, session.user.id);

    try {
      await revalidateTenantStorefront(tenantId, { catalog: true });
    } catch (revalidateErr) {
      console.warn('[POST /api/store/categories/[id]/restore] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({
      success: true,
      data: restored,
      message: 'Category restored',
    });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/categories/[id]/restore');
  }
}
