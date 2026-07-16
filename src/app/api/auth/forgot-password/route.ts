import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils/request';
import { sendPasswordResetEmail } from '@/lib/services/email.service';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';

const forgotPasswordSchema = z.object({
  email: z.string().email('A valid email address is required'),
});

const consistentResponse = {
  message:
    'If the email is registered, a password reset link has been sent. Please check your inbox and spam folder.',
};

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  const limit = checkRateLimit(ipAddress, 'forgot', 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(consistentResponse, { status: 200 });
  }

  recordFailedAttempt(ipAddress, 'forgot', 60 * 60 * 1000);

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(consistentResponse, { status: 200 });
  }

  const email = parsed.data.email.toLowerCase();

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

  await prisma.verificationToken.deleteMany({
    where: {
      identifier: user.email,
    },
  });

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires,
    },
  });

  const baseUrl =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail(user.email, resetUrl);

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

  return NextResponse.json(consistentResponse, { status: 200 });
}
