import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { updateTimeClockRecord } from '@/lib/services/timeclock.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

const UpdateTimeClockSchema = z
  .object({
    clockedInAt: z.string().min(1).optional(),
    clockedOutAt: z.string().min(1).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

/** Adjust a staff member's clock-in/clock-out (e.g. a forgotten clock-out). */
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
    if (!hasPermission(session.user, PERMISSIONS.STAFF.manageAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = UpdateTimeClockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Validation failed',
          },
        },
        { status: 400 },
      );
    }

    const { id } = await params;
    const record = await updateTimeClockRecord(
      tenantId,
      id,
      parsed.data,
      session.user.id,
      session.user.role,
    );
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return toErrorResponse(error, 'PATCH /api/store/timeclock/[id]');
  }
}
