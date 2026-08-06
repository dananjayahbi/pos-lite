import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { archiveProduct } from '@/lib/services/product.service';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';

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
    const updated = await archiveProduct(tenantId, id, session.user.id);

    // Revalidate so archive/unarchive state is reflected on the storefront immediately.
    try {
      await revalidateTenantStorefront(tenantId, { productIds: [id] });
    } catch (revalidateErr) {
      console.warn('[POST /api/store/products/[id]/archive] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: updated.isArchived ? 'Product archived' : 'Product unarchived',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    console.error('POST /api/store/products/[id]/archive error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
