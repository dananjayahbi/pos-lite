import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { createTimeClockRecord } from '@/lib/services/timeclock.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * POST /api/store/timeclock/records — add a missing clock punch (ARGUS #349).
 *
 * A day with no punches could not be repaired before: the adjust dialog only
 * edited existing rows. Manual entries are validated (no overlap, clock-out
 * after clock-in, no future times), tenant-scoped and audited.
 */

const CreateTimeClockSchema = z.object({
  userId: z.string().min(1, 'Staff member is required'),
  clockedInAt: z.string().min(1, 'Clock-in time is required'),
  clockedOutAt: z.string().min(1).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

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
    if (!hasPermission(session.user, PERMISSIONS.STAFF.manageAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = CreateTimeClockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Validation failed',
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const record = await createTimeClockRecord(
      tenantId,
      parsed.data,
      session.user.id,
      session.user.role,
    );
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/timeclock/records');
  }
}
