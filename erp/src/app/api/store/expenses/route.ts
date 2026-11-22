import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getExpenses, createExpense } from '@/lib/services/expense.service';
import { CreateExpenseSchema } from '@/lib/validators/expense.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';
import { normalizeExpenseSearch } from '@/lib/expenses/filter';
import {
  authorizeExpenseWrite,
  resolveExpenseApprovalThreshold,
} from '@/lib/expenses/approval-policy';

export async function GET(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.EXPENSE.viewExpense)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const result = await getExpenses(tenantId, {
      category: searchParams.get('category') ?? undefined,
      search: normalizeExpenseSearch(searchParams.get('search')),
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      // XC-01: malformed page/pageSize now 400 instead of NaN → 500.
      page: parseQueryInt(searchParams, 'page', { min: 1, max: 1_000_000 }),
      pageSize: parseQueryInt(searchParams, 'pageSize', { min: 1, max: 200 }),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/expenses');
  }
}

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

    if (!hasPermission(session.user, PERMISSIONS.EXPENSE.createExpense)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error?.issues?.[0]?.message ?? 'Validation failed' } },
        { status: 400 },
      );
    }

    // ARGUS #397: creation above the configured threshold is an approval
    // decision. Without a status/approved-by column this is the strongest
    // control available: it decides WHO may record the spend up front.
    const approval = authorizeExpenseWrite({
      user: session.user,
      action: 'create',
      amount: parsed.data.amount,
      threshold: resolveExpenseApprovalThreshold(),
    });
    if (!approval.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'APPROVAL_REQUIRED', message: approval.reason } },
        { status: 403 },
      );
    }

    // M19-01 (D2): an overdraft override is a privileged exception — only an
    // actor holding the expense-approval permission may request it.
    if (parsed.data.overdrawApproved === true && !hasPermission(session.user, PERMISSIONS.EXPENSE.approveExpense)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only managers and owners can approve a petty-cash overdraft' } },
        { status: 403 },
      );
    }

    const expense = await createExpense(tenantId, {
      ...parsed.data,
      recordedById: session.user.id,
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    // M19-01 (D2): a blocked overdraft is a typed 422, not a raw 500.
    if (error instanceof Error && error.message.includes('Petty cash fund cannot go negative')) {
      return NextResponse.json(
        { success: false, error: { code: 'PETTY_CASH_OVERDRAW', message: error.message } },
        { status: 422 },
      );
    }
    return toErrorResponse(error, 'POST /api/store/expenses');
  }
}
