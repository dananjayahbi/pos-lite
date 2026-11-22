import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MATCH_MESSAGE,
  PASSWORD_MAX_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
  PASSWORD_REQUIRED_MESSAGE,
  PASSWORD_SAME_MESSAGE,
  passwordByteLength,
} from '@/lib/auth/password-policy.core';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/utils/request';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import {
  checkRateLimit,
  clearRateLimitBucket,
  recordFailedAttempt,
} from '@/lib/rate-limit';

const PASSWORD_CHANGE_MAX_ATTEMPTS = 5;
const PASSWORD_CHANGE_WINDOW_MS = 15 * 60 * 1000;

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: PASSWORD_REQUIRED_MESSAGE })
      .min(1, PASSWORD_REQUIRED_MESSAGE),
    newPassword: z
      .string({ error: PASSWORD_MIN_MESSAGE })
      .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE)
      .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
        message: PASSWORD_MAX_MESSAGE,
      }),
    confirmPassword: z
      .string({ error: 'Password confirmation is required' })
      .min(1, 'Password confirmation is required'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: PASSWORD_MATCH_MESSAGE,
    path: ['confirmPassword'],
  });

/** GET /api/settings/account — return the current user's account details. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { message: 'Not authenticated' } }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('GET /api/settings/account error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch account details' } },
      { status: 500 },
    );
  }
}

/** POST /api/settings/account — change the current user's password. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { message: 'Not authenticated' } }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid payload',
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true, role: true, tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 });
    }

    const ip = getClientIp(request);
    const limiterKey = `account-password:${user.id}`;
    const limit = checkRateLimit(
      ip,
      limiterKey,
      PASSWORD_CHANGE_MAX_ATTEMPTS,
      PASSWORD_CHANGE_WINDOW_MS,
    );
    if (!limit.allowed) {
      void createAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'User',
        entityId: user.id,
        action: AUTH_ACTIONS.PASSWORD_CHANGE_THROTTLED,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Too many password attempts. Try again later.' },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000))) },
        },
      );
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      recordFailedAttempt(ip, limiterKey, PASSWORD_CHANGE_WINDOW_MS);
      void createAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'User',
        entityId: user.id,
        action: AUTH_ACTIONS.PASSWORD_CHANGE_FAILED,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json(
        { success: false, error: { message: 'Current password is incorrect' } },
        { status: 400 },
      );
    }

    // ARGUS #505: the API must enforce the same "must differ" rule the form
    // shows; otherwise a caller can "change" to the identical password, bump
    // sessionVersion and rotate nothing.
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: PASSWORD_SAME_MESSAGE,
            details: [{ path: 'newPassword', message: PASSWORD_SAME_MESSAGE }],
          },
        },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    clearRateLimitBucket(ip, limiterKey);

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      action: AUTH_ACTIONS.PASSWORD_CHANGED,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/settings/account error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update password' } },
      { status: 500 },
    );
  }
}
