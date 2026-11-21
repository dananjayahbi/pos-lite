import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ok, toErrorResponse, unauthorized, validationError } from '@/lib/api/error-envelope';
import { markPayrollRunPaid } from '@/lib/services/payroll.service';
import { MarkPayrollPaidSchema } from '@/lib/validators/payroll.validators';

/**
 * POST /api/store/payroll/runs/[id]/pay — ARGUS #372/#373.
 * Marks a generated run PAID, settles its reserved commission and posts the
 * salary/statutory/commission expenses from the chosen payment account.
 */
export async function POST(
  request: Request,
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

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = MarkPayrollPaidSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return validationError(parsed.error.issues, parsed.error.issues[0]?.message);
    }

    const { id } = await params;
    const run = await markPayrollRunPaid({
      tenantId,
      runId: id,
      actorId: session.user.id,
      actorRole: session.user.role ?? 'UNKNOWN',
      paymentAccountId: parsed.data.paymentAccountId,
      ...(parsed.data.paidDate ? { paidDate: new Date(parsed.data.paidDate) } : {}),
    });

    return ok(run);
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payroll/runs/[id]/pay');
  }
}
