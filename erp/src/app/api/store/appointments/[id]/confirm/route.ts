import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { confirmAppointment } from '@/lib/services/appointment.service';

/**
 * ARGUS #125 — SCHEDULED → CONFIRMED. The lifecycle map has always allowed this
 * edge, but no route existed, so a default (require-confirmation) booking could
 * never reach check-in from the UI.
 */
export async function POST(
  _request: Request,
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.editAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const appointment = await confirmAppointment(tenantId, id);

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('POST /api/store/appointments/[id]/confirm error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message === 'APPOINTMENT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } },
        { status: 404 },
      );
    }

    if (message === 'INVALID_STATUS_TRANSITION') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: 'That status change is not allowed from the appointment\'s current state',
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    );
  }
}
