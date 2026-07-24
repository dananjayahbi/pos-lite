import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCashFlowStatement } from '@/lib/services/cashflow.service';

export async function GET(request: Request) {
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

    const role = session.user.role;
    if (
      role !== 'OWNER' &&
      role !== 'MANAGER' &&
      !hasPermission(session.user, PERMISSIONS.REPORT.viewCashflowReport)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');

    if (!dateFromParam || !dateToParam) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'dateFrom and dateTo are required' } },
        { status: 400 },
      );
    }

    const dateFrom = new Date(dateFromParam);
    const dateTo = new Date(dateToParam);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date format' } },
        { status: 400 },
      );
    }

    const result = await getCashFlowStatement(tenantId, dateFrom, dateTo);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /api/store/expenses/cash-flow error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate cash flow statement' } },
      { status: 500 },
    );
  }
}
