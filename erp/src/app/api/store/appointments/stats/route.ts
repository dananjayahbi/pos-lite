import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAppointmentStats } from '@/lib/services/appointment.service';
import { parseQueryDate } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    // M27-07/BUG-89: malformed date params used to reach new Date() → Invalid
    // Date → 500. XC-01's parser turns them into a typed 400.
    const dateFrom = parseQueryDate(url.searchParams, 'dateFrom')?.toISOString();
    const dateTo = parseQueryDate(url.searchParams, 'dateTo')?.toISOString();

    const stats = await getAppointmentStats(tenantId, dateFrom, dateTo);

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/appointments/stats');
  }
}
