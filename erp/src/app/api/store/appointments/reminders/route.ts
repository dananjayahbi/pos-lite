import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getReminderHistory } from '@/lib/services/appointment-reminder.service';

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

    // M27-03/BUG-87: reminder history exposes patient PII — gate on the same
    // view key the appointment detail route uses.
    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const appointmentId = url.searchParams.get('appointmentId');

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'appointmentId parameter is required' } },
        { status: 400 },
      );
    }

    const reminders = await getReminderHistory(tenantId, appointmentId);

    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    console.error('GET /api/store/appointments/reminders error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
