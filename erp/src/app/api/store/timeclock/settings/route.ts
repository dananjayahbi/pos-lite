import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { readAttendanceCalendar, saveAttendanceCalendar } from '@/lib/services/timeclock.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * Tenant attendance calendar (ARGUS #348) — stored in
 * `Tenant.settings.attendance` so the daily view, the monthly report/CSV and
 * the payslip share one definition of working days and holidays. No schema
 * change.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const AttendanceCalendarSchema = z
  .object({
    /** ISO weekdays: 1 = Monday … 7 = Sunday. At least one working day. */
    workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    /** YYYY-MM-DD holiday dates. */
    holidays: z.array(z.string().regex(YMD, 'Holiday dates must be YYYY-MM-DD')).max(400),
    /** Worked minutes required for a full Present day. */
    fullDayMinutes: z.number().int().min(60).max(1440).optional(),
    /** Worked minutes required for a Half Day. */
    halfDayMinutes: z.number().int().min(30).max(1439).optional(),
    /** Maximum shift length before an open punch is capped (ARGUS #351). */
    maxShiftMinutes: z.number().int().min(60).max(1440).optional(),
  })
  .refine(
    (value) =>
      value.fullDayMinutes === undefined ||
      value.halfDayMinutes === undefined ||
      value.halfDayMinutes < value.fullDayMinutes,
    { message: 'Half-day minutes must be below the full-day minutes', path: ['halfDayMinutes'] },
  );

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { error: 'UNAUTHORIZED' as const, session: null };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { error: 'UNAUTHORIZED' as const, session: null };
  return { error: null, session };
}

export async function GET() {
  try {
    const { error, session } = await requireSession();
    if (error || !session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId!;
    if (!hasPermission(session.user, PERMISSIONS.STAFF.viewAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const calendar = await readAttendanceCalendar(tenantId);
    return NextResponse.json({ success: true, data: calendar });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/timeclock/settings');
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, session } = await requireSession();
    if (error || !session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId!;
    if (!hasPermission(session.user, PERMISSIONS.STAFF.manageAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = AttendanceCalendarSchema.safeParse(body);
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

    const calendar = await saveAttendanceCalendar(
      tenantId,
      parsed.data,
      session.user.id,
      session.user.role,
    );
    return NextResponse.json({ success: true, data: calendar });
  } catch (error) {
    return toErrorResponse(error, 'PATCH /api/store/timeclock/settings');
  }
}
