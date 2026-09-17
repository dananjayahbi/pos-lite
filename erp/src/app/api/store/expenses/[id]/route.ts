import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getExpenseById, updateExpense, deleteExpense } from '@/lib/services/expense.service';
import { UpdateExpenseSchema } from '@/lib/validators/expense.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const expense = await getExpenseById(tenantId, id);
    if (!expense) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error('GET /api/store/expenses/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch expense' } },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const existing = await getExpenseById(tenantId, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = UpdateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error?.issues?.[0]?.message ?? 'Validation failed' } },
        { status: 400 },
      );
    }

    // M19-01 (D2): an overdraft override requires the expense-approval permission.
    const overdrawApproved = parsed.data.overdrawApproved === true;
    if (overdrawApproved && !hasPermission(session.user, PERMISSIONS.EXPENSE.approveExpense)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only managers and owners can approve a petty-cash overdraft' } },
        { status: 403 },
      );
    }

    const expense = await updateExpense(tenantId, id, {
      ...parsed.data,
      ...(overdrawApproved ? { overdrawApproved: true } : {}),
      actorId: session.user.id,
    });
    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    // M19-01 (D2): a blocked overdraft is a typed 422, not a raw 500.
    if (error instanceof Error && error.message.includes('Petty cash fund cannot go negative')) {
      return NextResponse.json(
        { success: false, error: { code: 'PETTY_CASH_OVERDRAW', message: error.message } },
        { status: 422 },
      );
    }
    return toErrorResponse(error, 'PATCH /api/store/expenses/[id]');
  }
}

/**
 * DELETE /api/store/expenses/[id]
 *
 * Removes an expense and restores any linked petty-cash fund balance. Gated on
 * `createExpense` (same as create/edit — deleting a spend is a bookkeeping write
 * of the same weight). This route was missing entirely: the service and UI both
 * supported removal while the API shipped no handler, so the endpoint 405'd.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const existing = await getExpenseById(tenantId, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } },
        { status: 404 },
      );
    }

    await deleteExpense(tenantId, id, session.user.id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return toErrorResponse(error, 'DELETE /api/store/expenses/[id]');
  }
}
