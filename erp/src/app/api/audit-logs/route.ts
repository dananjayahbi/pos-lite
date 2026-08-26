import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAuditLogs } from '@/lib/services/audit.service';

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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.viewAuditLog);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get('entityType') ?? undefined;
    const action = searchParams.get('action') ?? undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10) || 50;
    const format = searchParams.get('format') ?? 'json';

    const result = await getAuditLogs(tenantId, {
      entityType,
      action,
      startDate,
      endDate,
      userId,
      page,
      pageSize,
    });

    if (format === 'csv') {
      const csvRows = [
        ['createdAt', 'entityType', 'entityId', 'action', 'actorId', 'actorRole', 'ipAddress'],
        ...result.data.map((entry) => [
          entry.createdAt.toISOString(),
          entry.entityType,
          entry.entityId,
          entry.action,
          entry.actorId ?? '',
          entry.actorRole,
          entry.ipAddress ?? '',
        ]),
      ];

      const csv = csvRows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="audit-log-export.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /api/audit-logs error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' } },
      { status: 500 },
    );
  }
}
