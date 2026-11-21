import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ok, toErrorResponse, unauthorized } from '@/lib/api/error-envelope';
import { getPayrollRun, getPayrollRunDetail, voidPayrollRun } from '@/lib/services/payroll.service';

/**
 * GET /api/store/payroll/runs/[id] - one generated run (ARGUS #377 keeps the
 * client honest about 404s instead of rendering an empty business state).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');
    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.viewPayroll)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    return ok(await getPayrollRunDetail(tenantId, id));
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payroll/runs/[id]');
  }
}

/**
 * DELETE /api/store/payroll/runs/[id] - ARGUS #375 void an unpaid run so a
 * mistaken (zero/unconfigured) month can be corrected without a migration.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');
    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.runPayroll)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const voided = await voidPayrollRun({
      tenantId,
      runId: id,
      actorId: session.user.id,
      actorRole: session.user.role ?? 'UNKNOWN',
    });
    return ok(voided);
  } catch (error) {
    return toErrorResponse(error, 'DELETE /api/store/payroll/runs/[id]');
  }
}
