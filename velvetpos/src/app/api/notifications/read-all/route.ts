import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH() {
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

    const result = await prisma.notificationRecord.updateMany({
      where: { tenantId, recipientId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({
      success: true,
      data: { count: result.count },
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all notifications as read' } },
      { status: 500 },
    );
  }
}
