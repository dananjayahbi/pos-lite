import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ok, toErrorResponse, unauthorized, validationError } from '@/lib/api/error-envelope';
import { generatePayrollRun, listPayrollRuns } from '@/lib/services/payroll.service';
import { GeneratePayrollSchema } from '@/lib/validators/payroll.validators';

export async function GET(request: NextRequest) {
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

    const limitParam = Number(request.nextUrl.searchParams.get('limit'));
    const runs = await listPayrollRuns(
      tenantId,
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 24,
    );
    return ok(runs);
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payroll/runs');
  }
}

export async function POST(request: NextRequest) {
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

    const body: unknown = await request.json();
    const parsed = GeneratePayrollSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues, parsed.error.issues[0]?.message);
    }

    const run = await generatePayrollRun({
      tenantId,
      month: parsed.data.month,
      generatedById: session.user.id,
      generatedByRole: session.user.role ?? 'UNKNOWN',
      overrides: parsed.data.overrides,
      notes: parsed.data.notes,
    });

    return ok(run, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payroll/runs');
  }
}
