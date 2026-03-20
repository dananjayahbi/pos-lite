import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { voidSale } from '@/lib/services/sale.service';

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
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

    if (!hasPermission(session.user, PERMISSIONS.SALE.voidSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await props.params;
    const sale = await voidSale(tenantId, id, session.user.id);

    return NextResponse.json({ success: true, data: sale });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Sale not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }
    if (message.includes('Only completed') || message.includes('not open')) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message } },
        { status: 400 },
      );
    }

    console.error('POST /api/store/sales/[id]/void error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
