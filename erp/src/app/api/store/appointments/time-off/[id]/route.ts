import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { approveTimeOff, deleteTimeOff } from '@/lib/services/appointment-availability.service';
import { ApproveTimeOffSchema } from '@/lib/validators/appointment.validators';

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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageSchedule)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = ApproveTimeOffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } },
        { status: 400 },
      );
    }

    const result = await approveTimeOff(tenantId, id, session.user.id, parsed.data.isApproved);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message === 'TIME_OFF_NOT_FOUND') {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Time off not found' } }, { status: 404 });
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

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageSchedule)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    await deleteTimeOff(tenantId, id);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message === 'TIME_OFF_NOT_FOUND') {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Time off not found' } }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 });
  }
}
