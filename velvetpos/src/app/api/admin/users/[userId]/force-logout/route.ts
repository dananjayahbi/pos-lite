import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import { clearSessionVersionCacheForUser } from '@/lib/auth/session-version-cache';
import { getClientIp } from '@/lib/utils/request';

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actor = session.user;
  const { userId } = await context.params;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Invalid user ID.' }, { status: 400 });
  }

  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tenantId: true,
      role: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (actor.role === 'OWNER') {
    if (!actor.tenantId || actor.tenantId !== targetUser.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      sessionVersion: {
        increment: 1,
      },
    },
  });

  clearSessionVersionCacheForUser(targetUser.id);

  await createAuditLog({
    tenantId: actor.tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'User',
    entityId: targetUser.id,
    action: AUTH_ACTIONS.FORCE_LOGOUT_TRIGGERED,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json(
    {
      message: 'User sessions have been invalidated.',
    },
    { status: 200 },
  );
}
