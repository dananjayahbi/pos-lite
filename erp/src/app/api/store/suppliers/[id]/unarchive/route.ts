import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { unarchiveSupplier } from '@/lib/services/supplier.service';

/**
 * M06-05 (OBS-10) — POST /api/store/suppliers/[id]/unarchive
 *
 * The recovery path the one-way archive route never had: flips `isActive`
 * back to true and writes a SUPPLIER_UNARCHIVED audit row with the real
 * actor. Permission-gated exactly like the sibling archive route
 * (`supplier:edit`), tenant-scoped via the session.
 *
 * Idempotent like archive (double unarchive → 200), so the UI can offer the
 * action from a possibly-stale list without a pre-check round-trip.
 *
 * Errors: 404 when the supplier doesn't exist (or belongs to another tenant).
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

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.editSupplier)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    await unarchiveSupplier(tenantId, id, {
      id: session.user.id,
      role: session.user.role,
    });

    return NextResponse.json({ success: true, data: { unarchived: true } });
  } catch (error) {
    // INF-02: 'Supplier not found' → 404 via the service sentinel; anything
    // unexpected is logged server-side and returned as a generic 500.
    return toErrorResponse(error, 'POST /api/store/suppliers/[id]/unarchive');
  }
}
