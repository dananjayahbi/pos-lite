import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { isModuleEnabled } from '@/lib/feature-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getRecoveryStaffPerformance } from '@/lib/services/recovery-stats.service';

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

function defaultFrom(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultTo(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** GET /api/reports/recovery-staff-performance?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorJson('UNAUTHORIZED', 'Not authenticated', 401);
    const tenantId = session.user.tenantId;
    if (!tenantId) return errorJson('UNAUTHORIZED', 'No tenant', 401);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!isModuleEnabled((tenant?.settings ?? {}) as Record<string, unknown>, 'delivery')) {
      return errorJson('FORBIDDEN', 'Delivery module is not enabled', 403);
    }
    if (!hasPermission(session.user, PERMISSIONS.REPORT.viewRecoveryReport)) {
      return errorJson('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const url = request.nextUrl;
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson('BAD_REQUEST', 'Invalid date parameters', 400);
    }

    const data = await getRecoveryStaffPerformance(tenantId, from, to);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/reports/recovery-staff-performance error:', error);
    return errorJson('INTERNAL_SERVER_ERROR', 'An unexpected error occurred', 500);
  }
}
