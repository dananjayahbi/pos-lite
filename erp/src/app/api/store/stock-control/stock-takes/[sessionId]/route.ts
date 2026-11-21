import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> },
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

    // ARGUS #205 — the direct session read is gated like the list so a user
    // without stock:take cannot load the counting data.
    if (!hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        initiatedBy: { select: { email: true } },
        approvedBy: { select: { email: true } },
        items: {
          include: {
            variant: {
              select: {
                sku: true,
                barcode: true,
                form: true,
                packSize: true,
                product: {
                  select: {
                    name: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!stockTakeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take session not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: stockTakeSession });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock take session' } },
      { status: 500 },
    );
  }
}
