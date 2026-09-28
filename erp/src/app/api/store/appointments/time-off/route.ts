import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getStaffTimeOff, requestTimeOff } from '@/lib/services/appointment-availability.service';
import { parseQueryDate } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { StaffTimeOffSchema } from '@/lib/validators/appointment.validators';
import type { StaffTimeOffInput } from '@/lib/validators/appointment.validators';

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

    // M27-02/OBS-80: reading the staff leave roster was the only appointment
    // list endpoint without a permission gate. Align with the siblings (the
    // availability calendar already gates `viewAppointment`).
    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const staffId = url.searchParams.get('staffId') ?? undefined;
    // M27-07/BUG-89: malformed date params used to reach new Date() → 500.
    const dateFrom = parseQueryDate(url.searchParams, 'dateFrom')?.toISOString();
    const dateTo = parseQueryDate(url.searchParams, 'dateTo')?.toISOString();

    const timeOff = await getStaffTimeOff(tenantId, staffId, dateFrom, dateTo);

    return NextResponse.json({ success: true, data: timeOff });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/appointments/time-off');
  }
}

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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageSchedule)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = StaffTimeOffSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const result = await requestTimeOff(tenantId, parsed.data as StaffTimeOffInput);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/appointments/time-off error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
