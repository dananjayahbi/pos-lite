import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ok, toErrorResponse, unauthorized } from '@/lib/api/error-envelope';
import {
  buildPayrollExportPreflights,
  getPayrollExportContext,
} from '@/lib/services/payroll-exports.service';

/**
 * GET /api/store/payroll/runs/[id]/exports/preflight - ARGUS #378.
 * Reports which required staff/employer details are blank per export so the
 * Reports page can flag or block a download before the file is produced.
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
    const context = await getPayrollExportContext(tenantId, id);
    return ok(buildPayrollExportPreflights(context));
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payroll/runs/[id]/exports/preflight');
  }
}
