import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { clockOut } from '@/lib/services/timeclock.service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ClockOutSchema = z.object({
  notes: z.string().max(500).optional(),
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
    const parsed = ClockOutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { clockedInAt: true },
    });

    if (!user?.clockedInAt) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Not currently clocked in' } },
        { status: 409 },
      );
    }

    const record = await clockOut(tenantId, session.user.id, parsed.data.notes);

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/timeclock/clock-out error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
