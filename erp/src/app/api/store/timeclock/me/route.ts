import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMyTimeClockStatus } from '@/lib/services/timeclock.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

/** Current user's clock status — used by the global header widget. */
export async function GET() {
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

    const status = await getMyTimeClockStatus(tenantId, session.user.id);
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/timeclock/me');
  }
}
