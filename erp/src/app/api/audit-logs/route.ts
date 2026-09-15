import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAuditLogs } from '@/lib/services/audit.service';
import { parseQueryInt, parseQueryDate } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    // M08-03 (BUG-37): SUPER_ADMIN is tenantless by design — serve the
    // cross-tenant system ledger instead of 401ing before the permission
    // check. An optional ?tenantId= narrows the view to one business.
    const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
    const tenantId = session.user.tenantId;
    if (!isSuperAdmin && !tenantId) {
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
    // XC-01 + XC-02: dates validated (garbage → 400, not Invalid Date in a
    // Prisma filter); pagination clamped.
    const startDate = parseQueryDate(searchParams, 'startDate');
    const endDate = parseQueryDate(searchParams, 'endDate');
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1, max: 1_000_000 }) ?? 1;
    const pageSize = parseQueryInt(searchParams, 'pageSize', { default: 50, min: 1, max: 200 }) ?? 50;
    const format = searchParams.get('format') ?? 'json';

    const result = isSuperAdmin
      ? await getCrossTenantAuditLogs(searchParams.get('tenantId') ?? undefined, {
          entityType,
          action,
          startDate,
          endDate,
          userId,
          page,
          pageSize,
        })
      : await getAuditLogs(tenantId as string, {
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

    return NextResponse.json({
      success: true,
      // XC-02: canonical list envelope — `data` is the array, pagination lives
      // in `meta` (was the nested `data.data` object that broke integrators,
      // BUG-59).
      data: result.data,
      meta: {
        page: result.page,
        limit: result.pageSize,
        total: result.total,
        hasMore: result.page * result.pageSize < result.total,
      },
    });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET /api/audit-logs');
  }
}

interface CrossTenantFilters {
  entityType?: string | undefined;
  action?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  userId?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/**
 * M08-03 (BUG-37) — SUPER_ADMIN system-wide ledger. Mirrors the pagination
 * and where-clause shape of `getAuditLogs` but omits `tenantId` entirely
 * (or filters to one business when `?tenantId=` is given), so tenantless
 * bridge rows (`tenantId:null` auth events, OBS-72) are visible here.
 */
async function getCrossTenantAuditLogs(
  tenantId: string | undefined,
  filters: CrossTenantFilters,
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? 50), 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = {};
  if (tenantId !== undefined) where.tenantId = tenantId;
  if (filters.entityType !== undefined) where.entityType = filters.entityType;
  if (filters.action !== undefined) where.action = filters.action;
  if (filters.userId !== undefined) where.actorId = filters.userId;
  if (filters.startDate !== undefined || filters.endDate !== undefined) {
    where.createdAt = {
      ...(filters.startDate !== undefined ? { gte: filters.startDate } : {}),
      ...(filters.endDate !== undefined ? { lte: filters.endDate } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total, page, pageSize };
}
