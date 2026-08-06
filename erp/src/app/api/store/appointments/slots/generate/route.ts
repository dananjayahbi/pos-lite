import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { generateSlotsForRange } from '@/lib/services/appointment-availability.service';
import { SlotGenerationSchema } from '@/lib/validators/appointment.validators';

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
    const parsed = SlotGenerationSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const result = await generateSlotsForRange(
      tenantId,
      parsed.data.startDate,
      parsed.data.endDate,
      parsed.data.staffIds,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('POST /api/store/appointments/slots/generate error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
