import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Distinct entity types and actions actually present in the audit ledger
 * (ARGUS #451).
 *
 * The filter menus used a hardcoded subset that could not represent the live
 * vocabulary (User/LOGIN_SUCCESS, Product, Appointment, Delivery, ...). The page
 * now populates them from this tenant-scoped facet query.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

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

    const requestedTenant = request.nextUrl.searchParams.get('tenantId') ?? undefined;
    const where: Prisma.AuditLogWhereInput = isSuperAdmin
      ? requestedTenant
        ? { tenantId: requestedTenant }
        : {}
      : { tenantId: tenantId as string };

    const [entityTypes, actions] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: { _all: true },
        orderBy: { _count: { entityType: 'desc' } },
        take: 500,
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 500,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        entityTypes: entityTypes.map((row) => ({ value: row.entityType, count: row._count._all })),
        actions: actions.map((row) => ({ value: row.action, count: row._count._all })),
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/audit-logs/facets');
  }
}
