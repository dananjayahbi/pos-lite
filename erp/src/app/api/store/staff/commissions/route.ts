import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCommissionSummaryForTenant } from '@/lib/services/commission.service';

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

    if (
      !hasPermission(session.user, PERMISSIONS.STAFF.viewStaff) &&
      !hasPermission(session.user, PERMISSIONS.STAFF.manageStaff)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const url = request.nextUrl;
    const now = new Date();
    const periodStart = url.searchParams.get('periodStart')
      ? new Date(url.searchParams.get('periodStart')!)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = url.searchParams.get('periodEnd')
      ? new Date(url.searchParams.get('periodEnd')!)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const summaries = await getCommissionSummaryForTenant(tenantId, periodStart, periodEnd);

    return NextResponse.json({ success: true, data: summaries });
  } catch (error) {
    console.error('GET /api/store/staff/commissions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
