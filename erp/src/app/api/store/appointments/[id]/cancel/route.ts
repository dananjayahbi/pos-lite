import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { cancelAppointment } from '@/lib/services/appointment.service';
import { CancelAppointmentSchema } from '@/lib/validators/appointment.validators';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.cancelAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = CancelAppointmentSchema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const appointment = await cancelAppointment(tenantId, id, session.user.id, reason);

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('POST /api/store/appointments/[id]/cancel error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message === 'APPOINTMENT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    );
  }
}
