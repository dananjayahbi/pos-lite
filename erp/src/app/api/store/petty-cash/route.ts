import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getPettyCashReadState,
  updateFund,
  getBalanceEquation,
  getPettyCashTopUps,
} from '@/lib/services/petty-cash.service';
import { UpdatePettyCashFundSchema } from '@/lib/validators/petty-cash.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { multiplePettyCashFundsMessage } from '@/lib/petty-cash/setup-state';

/**
 * GET /api/store/petty-cash is read-only (ARGUS #408). Opening the page must
 * not create a fund, payment account or opening-balance ledger entry. When no
 * fund exists the response carries `setupRequired`; duplicates carry
 * `multipleFunds` instead of silently returning the first.
 */
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

    const state = await getPettyCashReadState(tenantId);
    if (state.multipleFunds) {
      return NextResponse.json({
        success: true,
        data: null,
        balance: null,
        topUps: [],
        setupRequired: false,
        multipleFunds: true,
        fundCount: state.fundCount,
        message: multiplePettyCashFundsMessage(state.fundCount),
      });
    }
    if (!state.fund) {
      return NextResponse.json({
        success: true,
        data: null,
        balance: null,
        topUps: [],
        setupRequired: true,
        multipleFunds: false,
      });
    }

    const balance = await getBalanceEquation(tenantId, state.fund.id);
    const topUps = await getPettyCashTopUps(tenantId, state.fund);
    return NextResponse.json({
      success: true,
      data: state.fund,
      balance,
      topUps,
      setupRequired: false,
      multipleFunds: false,
    });
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
