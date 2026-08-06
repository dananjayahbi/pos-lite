import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAppointmentServices, createAppointmentService } from '@/lib/services/appointment.service';
import { AppointmentServiceSchema } from '@/lib/validators/appointment.validators';
import type { AppointmentServiceInput } from '@/lib/validators/appointment.validators';

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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const services = await getAppointmentServices(tenantId);

    return NextResponse.json({ success: true, data: services });
  } catch (error) {
    console.error('GET /api/store/appointments/services error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageServices)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = AppointmentServiceSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const service = await createAppointmentService(tenantId, parsed.data as AppointmentServiceInput);

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/appointments/services error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'SERVICE_NAME_EXISTS' ? 409 : 500;
    return NextResponse.json(
      { success: false, error: { code: status === 409 ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR', message } },
      { status },
    );
  }
}
