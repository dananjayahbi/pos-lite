import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/utils/request';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password confirmation is required'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
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
        { success: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid payload' } },
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

    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: { message: 'Current password is incorrect' } },
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

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      action: AUTH_ACTIONS.PASSWORD_RESET_COMPLETED,
      ipAddress: getClientIp(request),
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
