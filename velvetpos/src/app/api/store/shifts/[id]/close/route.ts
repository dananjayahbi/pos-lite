import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { CloseShiftSchema } from '@/lib/validators/shift.validators';
import { closeShift } from '@/lib/services/shift.service';

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
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

    if (!hasPermission(session.user, PERMISSIONS.STAFF.closeShift)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await props.params;

    const body = await _request.json();
    const parsed = CloseShiftSchema.safeParse(body);
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

    const result = await closeShift(tenantId, id, session.user.id, {
      closingCashCount: parsed.data.closingCashCount,
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Shift not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }
    if (message === 'Shift is not open') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message } },
        { status: 400 },
      );
    }
    if (message.startsWith('FORBIDDEN:')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message } },
        { status: 403 },
      );
    }

    console.error('POST /api/store/shifts/[id]/close error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
