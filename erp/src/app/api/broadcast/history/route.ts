import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';

// M31-03 (OBS-53): status + counters now live in the filters JSON. Older rows
// predate that and carry only `analytics`, so the parser still tolerates the
// flat shape.
function parseBroadcastFilters(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) {
    return { criteria: {}, analytics: {}, status: 'COMPLETED' as const };
  }

  const data = raw as Record<string, unknown>;
  const criteria = typeof data.criteria === 'object' && data.criteria !== null ? data.criteria as Record<string, unknown> : data;
  const analytics = typeof data.analytics === 'object' && data.analytics !== null ? data.analytics as Record<string, unknown> : {};
  const status = data.status === 'SENDING' ? ('SENDING' as const) : ('COMPLETED' as const);

  return { criteria, analytics, status };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } }, { status: 401 });
    }

    // M31-02 (OBS-52): the history surface reads the same audience/broadcast
    // data as the composer, so it carries the composer's own permission rather
    // than a hand-maintained role list.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.BROADCAST.send);
    if (forbidden) return forbidden;

    const broadcasts = await prisma.customerBroadcast.findMany({
      where: { tenantId },
      include: {
        sentBy: { select: { email: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    const data = broadcasts.map((broadcast) => {
      const parsed = parseBroadcastFilters(broadcast.filters);
      return {
        id: broadcast.id,
        message: broadcast.message,
        sentAt: broadcast.sentAt,
        recipientCount: broadcast.recipientCount,
        sentByEmail: broadcast.sentBy.email,
        criteria: parsed.criteria,
        analytics: parsed.analytics,
        status: parsed.status,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/broadcast/history error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch broadcast history' } }, { status: 500 });
  }
}
