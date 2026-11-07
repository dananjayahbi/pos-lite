import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse, unauthorized } from '@/lib/api/error-envelope';
import { getPayrollRun } from '@/lib/services/payroll.service';
import {
  buildPayrollPayslip,
  payslipFilename,
} from '@/lib/services/payroll-payslip.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');

    const { id, userId } = await params;
    const isSelf = session.user.id === userId;
    if (!isSelf && !hasPermission(session.user, PERMISSIONS.PAYROLL.viewPayroll)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const run = await getPayrollRun(tenantId, id);
    const { pdf, item } = await buildPayrollPayslip(tenantId, run, userId);

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${payslipFilename(run.periodMonth, item.staffName)}"`,
        'Content-Length': String(pdf.byteLength),
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payroll/runs/[id]/payslips/[userId]');
  }
}
