import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { clockIn } from '@/lib/services/timeclock.service';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api/error-envelope';

const ClockInSchema = z.object({
  shiftId: z.string().optional(),
  /** Clock-out for an open punch from a previous day (explicit confirmation). */
  closePreviousPunchAt: z.string().min(1).optional(),
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

    const body = await request.json().catch(() => ({}));
    const parsed = ClockInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
        { status: 400 },
      );
    }

    // The service owns conflict detection: a same-day open punch is
    // ALREADY_CLOCKED_IN; a previous-day one is OPEN_PUNCH_FROM_PREVIOUS_DAY
    // with the punch details the widget needs to offer closing it (ARGUS #351).
    const record = await clockIn(tenantId, session.user.id, parsed.data.shiftId, {
      closePreviousPunchAt: parsed.data.closePreviousPunchAt,
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/timeclock/clock-in');
  }
}
