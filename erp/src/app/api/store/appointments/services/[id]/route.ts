import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getAppointmentServiceById,
  updateAppointmentService,
  deleteAppointmentService,
} from '@/lib/services/appointment.service';
import { UpdateAppointmentServiceSchema } from '@/lib/validators/appointment.validators';
import type { UpdateAppointmentServiceInput } from '@/lib/validators/appointment.validators';

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

    const { id } = await params;
    const service = await getAppointmentServiceById(tenantId, id);

    return NextResponse.json({ success: true, data: service });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message === 'SERVICE_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } },
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageServices)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateAppointmentServiceSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const cleanData = Object.fromEntries(
      Object.entries(parsed.data).filter(([_, v]) => v !== undefined),
    ) as UpdateAppointmentServiceInput;
    const service = await updateAppointmentService(tenantId, id, cleanData);

    return NextResponse.json({ success: true, data: service });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message === 'SERVICE_NOT_FOUND') {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } }, { status: 404 });
    }
    if (message === 'SERVICE_NAME_EXISTS') {
      return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'Service name already exists' } }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 });
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageServices)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    await deleteAppointmentService(tenantId, id);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message === 'SERVICE_NOT_FOUND') {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 });
  }
}
