import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markAllNotificationsRead } from '@/lib/notifications/read-all';

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

    // M32-02 (OBS-61): chunked sweep (lib/notifications/read-all.ts) instead of
    // one unbounded updateMany — response shape and exact-count semantics are
    // unchanged (the count is the sum of the per-chunk updates).
    const count = await markAllNotificationsRead(tenantId, session.user.id);

    return NextResponse.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all notifications as read' } },
      { status: 500 },
    );
  }
}
