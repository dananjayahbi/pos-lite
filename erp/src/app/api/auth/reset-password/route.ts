import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/utils/request';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password confirmation is required'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 },
    );
  }

  const { token, newPassword } = parsed.data;

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has already been used.' },
      { status: 400 },
    );
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json(
      { error: 'This reset link has expired. Please request a new one.' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      email: verificationToken.identifier,
      deletedAt: null,
    },
    select: {
      id: true,
      tenantId: true,
      role: true,
    },
  });

  if (!user) {
    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json(
      { error: 'This reset link is invalid or has already been used.' },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  await createAuditLog({
    tenantId: user.tenantId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user.id,
    action: AUTH_ACTIONS.PASSWORD_RESET_COMPLETED,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
