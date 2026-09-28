import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * M32-02 (OBS-60) — mark a single notification unread again.
 *
 * The read-state was previously one-way (unread → read), so a mis-click — or a
 * QA run that had consumed the unread fixture pool — could not be undone
 * without direct DB surgery. This is the Gmail-style inverse of `[id]/read`.
 *
 * Deliberately a structural mirror of `[id]/read/route.ts`: same auth guard
 * order, same tenant/recipient scoping via `findFirst`, same 404 for a row that
 * is not the caller's (foreign ids are indistinguishable from unknown ones — no
 * existence disclosure), same `{ success: true, data: <notification> }` shape.
 */
export async function PATCH(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
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

    const { id } = await props.params;

    const notification = await prisma.notificationRecord.findFirst({
      where: { id, tenantId, recipientId: session.user.id },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } },
        { status: 404 },
      );
    }

    const updated = await prisma.notificationRecord.update({
      where: { id },
      data: { isRead: false },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Mark notification unread error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as unread' } },
      { status: 500 },
    );
  }
}