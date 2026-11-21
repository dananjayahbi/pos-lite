import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { setupPettyCashFund } from '@/lib/services/petty-cash.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * POST /api/store/petty-cash/setup
 *
 * ARGUS #408 - setup is an explicit, idempotent action. The old GET lazily
 * created the fund, payment account and opening-balance ledger entries for any
 * user holding only `petty_cash:view`. This endpoint requires
 * `petty_cash:manage` and is serialized by the service's tenant lock.
 */
export async function POST() {
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
    if (!hasPermission(session.user, PERMISSIONS.PETTY_CASH.managePettyCash)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { fund, created } = await setupPettyCashFund(tenantId, session.user.id);
    return NextResponse.json({ success: true, data: fund, created });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/petty-cash/setup');
  }
}
