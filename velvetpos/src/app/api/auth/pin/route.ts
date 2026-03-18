import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils/request';
import { AUTH_ACTIONS, createAuditLog, hashEmailForAudit } from '@/lib/services/audit.service';

const pinSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits'),
});

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  const limit = checkRateLimit(ipAddress, 'pin', 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many attempts. Please wait before trying again.',
        resetAt: limit.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);

  if (!parsed.success) {
    recordFailedAttempt(ipAddress, 'pin', 15 * 60 * 1000);
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const { email, pin } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      pin: true,
      sessionVersion: true,
      permissions: true,
    },
  });

  if (!user || !user.pin) {
    recordFailedAttempt(ipAddress, 'pin', 15 * 60 * 1000);
    await createAuditLog({
      tenantId: user?.tenantId ?? null,
      actorId: user?.id ?? null,
      actorRole: user?.role ?? 'UNKNOWN',
      entityType: 'User',
      entityId: user?.id ?? hashEmailForAudit(email),
      action: AUTH_ACTIONS.PIN_LOGIN_FAILED,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }

  const isPinValid = await bcrypt.compare(pin, user.pin);

  if (!isPinValid) {
    recordFailedAttempt(ipAddress, 'pin', 15 * 60 * 1000);
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      action: AUTH_ACTIONS.PIN_LOGIN_FAILED,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }

  await createAuditLog({
    tenantId: user.tenantId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user.id,
    action: AUTH_ACTIONS.PIN_LOGIN_SUCCESS,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sessionVersion: user.sessionVersion,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    },
  });
}
