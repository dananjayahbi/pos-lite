import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getDailyAttendance, upsertAttendanceDay } from '@/lib/services/timeclock.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { AttendanceStatus } from '@/generated/prisma/client';

const UpsertAttendanceSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string().trim().max(500).nullable().optional(),
});

/** All-staff daily attendance for the selected date. */
export async function GET(request: NextRequest) {
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
    if (!hasPermission(session.user, PERMISSIONS.STAFF.viewAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const date = request.nextUrl.searchParams.get('date') ?? undefined;
    const result = await getDailyAttendance(tenantId, date);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/timeclock/attendance');
  }
}

/** Mark Leave/Absent/Half Day/Holiday/Present for one staff member and day. */
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

    const body = await request.json();
    const parsed = UpsertAttendanceSchema.safeParse(body);
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

    const record = await upsertAttendanceDay(
      tenantId,
      parsed.data,
      session.user.id,
      session.user.role,
    );
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/timeclock/attendance');
  }
}
