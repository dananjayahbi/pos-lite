import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCommissionPayouts } from '@/lib/services/commission.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt, parseQueryDate } from '@/lib/api/query-params';

export async function GET(request: NextRequest) {
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

    if (!['MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only managers and owners can view payouts' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? undefined;
    // XC-01: unvalidated new Date() → Invalid Date into Prisma (BUG-45 class).
    const periodStart = parseQueryDate(searchParams, 'periodStart');
    const periodEnd = parseQueryDate(searchParams, 'periodEnd');
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1 }) ?? 1;
    const pageSize = parseQueryInt(searchParams, 'pageSize', { default: 20, min: 1, max: 100 }) ?? 20;

    const payouts = await getCommissionPayouts(tenantId, { userId, periodStart, periodEnd, page, pageSize });
    return NextResponse.json({ success: true, data: payouts });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET /api/store/staff/commissions/payouts');
  }
}
