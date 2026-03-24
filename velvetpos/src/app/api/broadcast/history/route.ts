import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function parseBroadcastFilters(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) {
    return { criteria: {}, analytics: {} };
  }

  const data = raw as Record<string, unknown>;
  const criteria = typeof data.criteria === 'object' && data.criteria !== null ? data.criteria as Record<string, unknown> : data;
  const analytics = typeof data.analytics === 'object' && data.analytics !== null ? data.analytics as Record<string, unknown> : {};

  return { criteria, analytics };
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

    if (['CASHIER', 'STOCK_CLERK'].includes(session.user.role)) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

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
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/broadcast/history error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch broadcast history' } }, { status: 500 });
  }
}
