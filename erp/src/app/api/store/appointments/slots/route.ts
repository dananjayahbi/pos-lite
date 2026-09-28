import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAvailableSlots } from '@/lib/services/appointment-availability.service';
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
    const dateRaw = url.searchParams.get('date');
    const staffId = url.searchParams.get('staffId') ?? undefined;
    const serviceId = url.searchParams.get('serviceId') ?? undefined;

    if (!dateRaw) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'date parameter is required' } },
        { status: 400 },
      );
    }

    // M27-07/BUG-89: malformed `date` used to reach new Date() → 500.
    const date = parseQueryDate(url.searchParams, 'date')!.toISOString().slice(0, 10);

    const slots = await getAvailableSlots(tenantId, date, staffId, serviceId);

    return NextResponse.json({ success: true, data: slots });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/appointments/slots');
  }
}
