import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
} from '@/lib/services/appointment.service';
import { UpdateAppointmentSchema } from '@/lib/validators/appointment.validators';
import type { UpdateAppointmentInput } from '@/lib/validators/appointment.validators';

export async function GET(
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const appointment = await getAppointmentById(tenantId, id);

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('GET /api/store/appointments/[id] error:', error);
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

export async function PATCH(
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.editAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const appointment = await updateAppointment(tenantId, id, parsed.data as UpdateAppointmentInput);

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('PATCH /api/store/appointments/[id] error:', error);
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

export async function DELETE(
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.cancelAppointment)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    await cancelAppointment(tenantId, id, session.user.id);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error('DELETE /api/store/appointments/[id] error:', error);
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
