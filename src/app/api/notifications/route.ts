import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 1), 50);
    const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
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
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } },
      { status: 500 },
    );
  }
}
