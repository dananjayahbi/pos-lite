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

    // ARGUS #52: a sale alert is stored as SALE_COMPLETED, but the sale may
    // have been voided since. Join the linked sale so the client can label the
    // row as voided (and show the reversed amount) without a schema change.
    const saleIds = Array.from(
      new Set(
        notifications
          .filter(
            (notification) =>
              notification.type === 'SALE_COMPLETED' &&
              notification.relatedEntityType === 'Sale' &&
              notification.relatedEntityId,
          )
          .map((notification) => notification.relatedEntityId as string),
      ),
    );

    const relatedSales = saleIds.length
      ? await prisma.sale.findMany({
          where: { tenantId, id: { in: saleIds } },
          // ARGUS #58: zero-value alerts also need the reason that was
          // persisted on the sale, so the row can say more than `Rs. 0.00`.
          // ARGUS #59: the buyer/product identifies the alert's title.
          select: {
            id: true,
            status: true,
            totalAmount: true,
            zeroValueReason: true,
            customer: { select: { name: true } },
            lines: {
              take: 1,
              orderBy: { createdAt: 'asc' },
              select: { productNameSnapshot: true },
            },
          },
        })
      : [];
    const saleById = new Map(
      relatedSales.map((sale) => [
        sale.id,
        {
          id: sale.id,
          status: sale.status,
          totalAmount: sale.totalAmount,
          zeroValueReason: sale.zeroValueReason,
          customerName: sale.customer?.name ?? null,
          productName: sale.lines[0]?.productNameSnapshot ?? null,
        },
      ]),
    );

    const enrichedNotifications = notifications.map((notification) => ({
      ...notification,
      relatedSale:
        notification.type === 'SALE_COMPLETED' && notification.relatedEntityId
          ? saleById.get(notification.relatedEntityId) ?? null
          : null,
    }));

    return NextResponse.json({
      success: true,
      data: { notifications: enrichedNotifications, unreadCount },
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
