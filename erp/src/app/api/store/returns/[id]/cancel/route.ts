import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { cancelReturn } from '@/lib/services/return.service';

const CancelReturnSchema = z.object({
  reason: z.string().trim().min(5, 'A reason of at least 5 characters is required').max(500),
});

/**
 * POST /api/store/returns/[id]/cancel - reverse a completed return entered in
 * error (ARGUS #102). Owner/manager only, reason required, audited.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
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

    const role = session.user.role;
    if (
      (role !== 'OWNER' && role !== 'MANAGER' && role !== 'SUPER_ADMIN') ||
      !hasPermission(session.user, PERMISSIONS.SALE.refundSale)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only an owner or manager with refund permission can reverse a return',
          },
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = CancelReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A reason is required', details: parsed.error.issues },
        },
        { status: 400 },
      );
    }

    const { id } = await props.params;
    const result = await cancelReturn(tenantId, id, session.user.id, parsed.data.reason);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/returns/[id]/cancel');
  }
}
