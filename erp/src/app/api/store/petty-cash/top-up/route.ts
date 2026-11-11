import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { topUpPettyCash, getBalanceEquation } from '@/lib/services/petty-cash.service';
import { TopUpPettyCashSchema } from '@/lib/validators/petty-cash.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * POST /api/store/petty-cash/top-up — "Add Cash In".
 *
 * Adds cash to the fund, posts the matching payment-account ledger entry (and
 * a source-account debit when a source is chosen), and returns the refreshed
 * balance equation.
 */
export async function POST(request: Request) {
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
    const parsed = TopUpPettyCashSchema.safeParse(body);
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

    const result = await topUpPettyCash(
      tenantId,
      session.user.id,
      session.user.role,
      parsed.data,
    );
    const balance = await getBalanceEquation(tenantId, result.fund.id);

    return NextResponse.json({
      success: true,
      data: {
        fund: result.fund,
        balance,
        amount: result.amount,
        description: result.description,
        sourceAccountId: result.sourceAccountId,
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/petty-cash/top-up');
  }
}
