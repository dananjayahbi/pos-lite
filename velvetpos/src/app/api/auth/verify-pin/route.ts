import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils/request';

const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits'),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const ipAddress = getClientIp(request);
    const rateLimitKey = `verify-pin:${session.user.id}`;
    const limit = checkRateLimit(ipAddress, rateLimitKey, 5, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait.' } },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = verifyPinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid PIN format' } },
        { status: 400 },
      );
    }

    const { pin } = parsed.data;

    const candidates = await prisma.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        pin: { not: null },
        isActive: true,
        deletedAt: null,
        role: { in: ['MANAGER', 'OWNER'] },
      },
      select: {
        id: true,
        role: true,
        pin: true,
      },
    });

    for (const candidate of candidates) {
      if (candidate.pin && (await bcrypt.compare(pin, candidate.pin))) {
        return NextResponse.json({
          success: true,
          data: { userId: candidate.id, role: candidate.role },
        });
      }
    }

    recordFailedAttempt(ipAddress, rateLimitKey, 60 * 1000);
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PIN', message: 'Invalid PIN' } },
      { status: 401 },
    );
  } catch (error) {
    console.error('POST /api/auth/verify-pin error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
