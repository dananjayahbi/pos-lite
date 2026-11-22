import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { mergeCustomers } from '@/lib/services/customer.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

const MergeSchema = z.object({
  primaryId: z.string().min(1, 'primaryId is required'),
  duplicateId: z.string().min(1, 'duplicateId is required'),
});

/**
 * POST /api/store/customers/merge — fold a duplicate customer into the one to
 * keep (ARGUS #320). The `customer:merge` permission existed but had no route.
 *
 * Tenant scoping is explicit: both ids are resolved with `tenantId` before the
 * transaction, so a caller can never move rows between tenants.
 */
export async function POST(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.mergeCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = MergeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid merge payload',
          },
        },
        { status: 400 },
      );
    }

    const result = await mergeCustomers(
      tenantId,
      parsed.data.primaryId,
      parsed.data.duplicateId,
      { id: session.user.id, role: session.user.role },
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/customers/merge');
  }
}
