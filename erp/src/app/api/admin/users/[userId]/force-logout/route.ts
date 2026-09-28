import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AUTH_ACTIONS, writeAuditLog } from '@/lib/services/audit.service';
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

  const bumped = await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      sessionVersion: {
        increment: 1,
      },
    },
    select: { sessionVersion: true },
  });

  // M01-06: the proxy gate reads sessionVersion straight from the DB (no
  // cache), so the bump above is effective on the target's very next request.

  await writeAuditLog({
    tenantId: actor.tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'User',
    entityId: targetUser.id,
    action: AUTH_ACTIONS.FORCE_LOGOUT_TRIGGERED,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  // M03-03 item 2: report the new version so the admin UI can show certainty.
  return NextResponse.json(
    {
      message: 'User sessions have been invalidated.',
      sessionVersion: bumped.sessionVersion,
      revokedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}
