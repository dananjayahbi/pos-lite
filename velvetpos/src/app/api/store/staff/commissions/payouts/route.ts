import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCommissionPayouts } from '@/lib/services/commission.service';

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

    if (!['MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only managers and owners can view payouts' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? undefined;
    const periodStart = searchParams.get('periodStart') ? new Date(searchParams.get('periodStart') as string) : undefined;
    const periodEnd = searchParams.get('periodEnd') ? new Date(searchParams.get('periodEnd') as string) : undefined;
    const page = Math.max(Number(searchParams.get('page') ?? '1') || 1, 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? '20') || 20, 1), 100);

    const payouts = await getCommissionPayouts(tenantId, { userId, periodStart, periodEnd, page, pageSize });
    return NextResponse.json({ success: true, data: payouts });
  } catch (error) {
    console.error('GET /api/store/staff/commissions/payouts error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
