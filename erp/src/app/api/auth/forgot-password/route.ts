import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import {
  checkAndRecordRateLimit,
  isDbRateLimitEnabled,
} from '@/lib/rate-limit-store';
import { mintPasswordResetToken } from '@/lib/auth/reset-token';
import { ApiError } from '@/lib/api/errors';
import { envelopeError, toErrorResponse } from '@/lib/api/error-envelope';
import { getClientIp } from '@/lib/utils/request';
import { sendPasswordResetEmail } from '@/lib/services/email.service';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';

/**
 * POST /api/auth/forgot-password
 *
 * M01-01 (BUG-11): the send result is no longer discarded — a token whose
 * email failed to deliver is DELETED immediately, so a leaked/undelivered
 * token can never complete a takeover. The public response stays neutral
 * (anti-enumeration is a passing QA contract); the failure signal goes to the
 * PASSWORD_RESET_DELIVERY_FAILED audit row.
 * M01-02 (BUG-16): limiter exhaustion now answers 429 + Retry-After (typed
 * envelope) and writes PASSWORD_RESET_THROTTLED. 429 is IP-scoped, so it says
 * nothing about whether the address exists. The bucket is DB-backed when
 * RATE_LIMIT_DB is set (survives restarts; in-memory stays the dev fallback).
 * M01-03 (BUG-18): token mint is transactional (delete+create) — at most one
 * live token per identifier even under concurrent bursts.
 */

const forgotPasswordSchema = z.object({
  email: z.string().email('A valid email address is required'),
});

const consistentResponse = {
  message:
    'If the email is registered, a password reset link has been sent. Please check your inbox and spam folder.',
};

const FORGOT_WINDOW_MS = 60 * 60 * 1000;
const FORGOT_MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? undefined;

    // Parse BEFORE consuming the budget so malformed bodies no longer burn
    // legitimate slots (the old route recorded on every request, pre-parse).
    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      // Still neutral — shape errors must not distinguish registered emails.
      return NextResponse.json(consistentResponse, { status: 200 });
    }

    const email = parsed.data.email.toLowerCase();

    // ── Limiter (check + consume atomically in DB mode) ─────────────────────
    const bucketKey = `forgot:${ipAddress.trim() || 'unknown'}`;
    let allowed = true;
    let resetAt = new Date(Date.now() + FORGOT_WINDOW_MS);

    if (isDbRateLimitEnabled()) {
      const result = await checkAndRecordRateLimit(
        bucketKey,
        FORGOT_MAX_ATTEMPTS,
        FORGOT_WINDOW_MS,
      );
      allowed = result.allowed;
      resetAt = result.resetAt;
    } else {
      const result = checkRateLimit(ipAddress, 'forgot', FORGOT_MAX_ATTEMPTS, FORGOT_WINDOW_MS);
      allowed = result.allowed;
      resetAt = result.resetAt;
      if (allowed) {
        recordFailedAttempt(ipAddress, 'forgot', FORGOT_WINDOW_MS);
      }
    }

    if (!allowed) {
      // M01-02: audit the suppression so ops see demand instead of a quiet hole.
      const target = await prisma.user.findFirst({
        where: { email, deletedAt: null },
        select: { id: true, tenantId: true, role: true },
      });
      await createAuditLog({
        tenantId: target?.tenantId ?? null,
        actorId: target?.id ?? null,
        actorRole: target?.role ?? 'ANONYMOUS',
        entityType: 'User',
        entityId: target?.id ?? email,
        action: AUTH_ACTIONS.PASSWORD_RESET_THROTTLED,
        ipAddress,
        userAgent,
      });

      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((resetAt.getTime() - Date.now()) / 1000),
      );
      const throttled = envelopeError(
        new ApiError(429, 'RATE_LIMITED', 'Too many reset requests. Please try again later.'),
      );
      throttled.headers.set('Retry-After', String(retryAfterSeconds));
      return throttled;
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
      },
    });

    // Consistent response prevents email enumeration.
    if (!user) {
      return NextResponse.json(consistentResponse, { status: 200 });
    }

    // M01-03: transactional mint — prior tokens die in the same transaction.
    const token = await mintPasswordResetToken(user.email);

    const { getBaseUrl } = await import('@/lib/utils/url');
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

    const sendResult = await sendPasswordResetEmail(user.email, resetUrl);

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      action: AUTH_ACTIONS.PASSWORD_RESET_REQUESTED,
      ipAddress,
      userAgent,
    });

    if (!sendResult.delivered) {
      // M01-01: never leave an undelivered token live — purge it and ledger
      // the failure for ops. The requester still gets the neutral 200.
      await prisma.verificationToken
        .deleteMany({ where: { identifier: user.email, token } })
        .catch((err) => {
          console.error('Failed to purge undelivered reset token:', err);
        });

      await createAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'User',
        entityId: user.id,
        action: AUTH_ACTIONS.PASSWORD_RESET_DELIVERY_FAILED,
        after: { reason: sendResult.reason ?? 'unknown' },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json(consistentResponse, { status: 200 });
  } catch (error) {
    // Unexpected failures answer the typed 500 envelope instead of a Next.js
    // stack page; nothing about the email's existence leaks.
    return toErrorResponse(error, 'forgot-password');
  }
}
