import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAuditLogs } from '@/lib/services/audit.service';

const DENIED_ROLES = new Set(['CASHIER', 'STOCK_CLERK']);

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

    if (DENIED_ROLES.has(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get('entityType') ?? undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10) || 50;

    const result = await getAuditLogs(tenantId, {
      entityType,
      startDate,
      endDate,
      userId,
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /api/audit-logs error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' } },
      { status: 500 },
    );
  }
}
