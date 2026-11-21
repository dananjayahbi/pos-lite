import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ok, toErrorResponse, unauthorized, validationError } from '@/lib/api/error-envelope';
import { getPayrollPreview } from '@/lib/services/payroll.service';
import { validatePayrollMonth } from '@/lib/payroll/payroll-month.core';

/** Live payroll preview for a month (no persistence). */
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

    // ARGUS #382: reject a malformed or future month at the route instead of
    // silently normalizing it downstream.
    const requested = validatePayrollMonth(request.nextUrl.searchParams.get('month'));
    if (!requested.ok) {
      return validationError([{ path: ['month'], message: requested.message }], requested.message);
    }

    const preview = await getPayrollPreview(tenantId, requested.month);
    return ok(preview);
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payroll/preview');
  }
}
