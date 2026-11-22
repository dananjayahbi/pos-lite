import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCommissionSummaryForTenant } from '@/lib/services/commission.service';
import {
  CommissionPeriodError,
  resolveCommissionPeriod,
} from '@/lib/utils/commission-period';

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

    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.viewPayroll)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const url = request.nextUrl;
    let range: ReturnType<typeof resolveCommissionPeriod>;
    try {
      // ARGUS #343: date-only windows are inclusive LOCAL calendar days, so a
      // default month always runs from the 1st to the last day (not 31 Oct -
      // 29 Nov in a UTC+05:30 shop).
      range = resolveCommissionPeriod(
        url.searchParams.get('periodStart'),
        url.searchParams.get('periodEnd'),
      );
    } catch (periodError) {
      if (periodError instanceof CommissionPeriodError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: periodError.message },
          },
          { status: 400 },
        );
      }
      throw periodError;
    }

    const summaries = await getCommissionSummaryForTenant(
      tenantId,
      range.periodStart,
      range.periodEnd,
    );

    return NextResponse.json({ success: true, data: summaries });
  } catch (error) {
    console.error('GET /api/store/staff/commissions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
