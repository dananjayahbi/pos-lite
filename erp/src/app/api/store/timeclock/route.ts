import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getTimeClockHistory } from '@/lib/services/timeclock.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';
import { prisma } from '@/lib/prisma';

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

    const url = request.nextUrl;
    const userId = url.searchParams.get('userId') ?? session.user.id;

    // M20-01 (XC-03): a non-self read is a staff-attendance privilege, not a
    // hard-coded role list — the same key the sidebar/staff page already uses.
    if (userId !== session.user.id && !hasPermission(session.user, PERMISSIONS.STAFF.viewAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot view other users\' time clock records' } },
        { status: 403 },
      );
    }

    // Cross-tenant isolation: an explicit `userId` must resolve to a member of
    // the caller's tenant. Without this an OWNER could read another tenant's
    // attendance by guessing ids. 404 (not 403) avoids leaking existence.
    if (userId !== session.user.id) {
      const target = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Staff member not found' } },
          { status: 404 },
        );
      }
    }

    // XC-01: malformed page/pageSize now 400 instead of NaN → 500.
    const page = parseQueryInt(url.searchParams, 'page', { default: 1, min: 1, max: 1_000_000 }) ?? 1;
    const pageSize = parseQueryInt(url.searchParams, 'pageSize', { default: 20, min: 1, max: 200 }) ?? 20;

    const result = await getTimeClockHistory(tenantId, userId, page, pageSize);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/timeclock');
  }
}
