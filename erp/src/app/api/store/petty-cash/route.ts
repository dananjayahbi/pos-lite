import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getOrCreateFund, updateFund, getBalanceEquation } from '@/lib/services/petty-cash.service';
import { UpdatePettyCashFundSchema } from '@/lib/validators/petty-cash.validators';

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
    const balance = await getBalanceEquation(tenantId, fund.id);
    return NextResponse.json({ success: true, data: fund, balance });
  } catch (error) {
    console.error('GET /api/store/petty-cash error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load petty cash fund' } },
      { status: 500 },
    );
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error?.issues?.[0]?.message ?? 'Validation failed' } },
        { status: 400 },
      );
    }

    if (!parsed.data.fundId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'fundId is required' } },
        { status: 400 },
      );
    }

    const { fundId, ...updates } = parsed.data;
    const fund = await updateFund(tenantId, fundId, updates, session.user.id);
    return NextResponse.json({ success: true, data: fund });
  } catch (error) {
    console.error('PATCH /api/store/petty-cash error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to update petty cash fund' } },
      { status: 500 },
    );
  }
}
