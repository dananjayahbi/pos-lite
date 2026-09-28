import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseQueryInt } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    // XC-01: malformed limit/page now 400 naming the param (BUG-45 class);
    // out-of-range still clamps to the [1,50] / [1,∞) windows.
    const limit = parseQueryInt(searchParams, 'limit', { default: 10, min: 1, max: 50 }) ?? 10;
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1, max: 1_000_000 }) ?? 1;
    const includeRead = searchParams.get('includeRead') === 'true';
    const statusParam = searchParams.get('status');
    const status = statusParam === 'all' || statusParam === 'read' || statusParam === 'unread'
      ? statusParam
      : includeRead
        ? 'all'
        : 'unread';
    const skip = (page - 1) * limit;

    const baseWhere = {
      tenantId,
      recipientId: session.user.id,
    };

    const where = {
      ...baseWhere,
      ...(status === 'read' ? { isRead: true } : {}),
      ...(status === 'unread' ? { isRead: false } : {}),
    };

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notificationRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notificationRecord.count({
        where: { tenantId, recipientId: session.user.id, isRead: false },
      }),
      prisma.notificationRecord.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { notifications, unreadCount },
      meta: {
        page,
        limit,
        total,
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'Notifications fetch');
  }
}
