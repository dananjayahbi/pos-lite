import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getOrCreateFund,
  updateFund,
  getBalanceEquation,
  getPettyCashTopUps,
} from '@/lib/services/petty-cash.service';
import { UpdatePettyCashFundSchema } from '@/lib/validators/petty-cash.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.PETTY_CASH.viewPettyCash)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const fund = await getOrCreateFund(tenantId, session.user.id);
    const balance = fund ? await getBalanceEquation(tenantId, fund.id) : null;
    const topUps = fund ? await getPettyCashTopUps(tenantId, fund) : [];
    return NextResponse.json({ success: true, data: fund, balance, topUps });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/petty-cash');
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.PETTY_CASH.managePettyCash)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = UpdatePettyCashFundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error?.issues?.[0]?.message ?? 'Validation failed',
          },
        },
        { status: 400 },
      );
    }

    if (!parsed.data.fundId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'fundId is required' } },
        { status: 400 },
      );
    }

    // Fund identity and thresholds are owner-controlled. Managers may still
    // manage the expense-category switches through the same endpoint.
    const touchesOwnerSettings =
      parsed.data.name !== undefined ||
      parsed.data.lowBalanceThreshold !== undefined ||
      parsed.data.openingBalance !== undefined;
    if (
      touchesOwnerSettings &&
      !hasPermission(session.user, PERMISSIONS.PETTY_CASH.manageFundSettings)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the owner can change petty-cash fund settings',
          },
        },
        { status: 403 },
      );
    }

    const { fundId, ...updates } = parsed.data;
    const fund = await updateFund(tenantId, fundId, updates, session.user.id);
    return NextResponse.json({ success: true, data: fund });
  } catch (error) {
    return toErrorResponse(error, 'PATCH /api/store/petty-cash');
  }
}
