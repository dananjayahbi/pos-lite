import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ok, toErrorResponse, unauthorized, validationError } from '@/lib/api/error-envelope';
import { getPayrollSettings, updatePayrollSettings } from '@/lib/services/payroll.service';
import { PayrollSettingsSchema } from '@/lib/validators/payroll.validators';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');
    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.managePayrollSettings)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    return ok(await getPayrollSettings(tenantId));
  } catch (error) {
    return toErrorResponse(error, 'GET /api/settings/payroll');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');
    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.managePayrollSettings)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = PayrollSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues, parsed.error.issues[0]?.message);
    }

    const settings = await updatePayrollSettings({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role ?? 'UNKNOWN',
      settings: parsed.data,
    });
    return ok(settings);
  } catch (error) {
    return toErrorResponse(error, 'PATCH /api/settings/payroll');
  }
}
