import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getExpensesForExport } from '@/lib/services/expense.service';
import { EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { csvDownloadResponse } from '@/lib/export';
import { normalizeExpenseSearch } from '@/lib/expenses/filter';
import {
  buildExpenseRegisterCsv,
  expenseRegisterFilename,
} from '@/lib/expenses/register-export';

/**
 * GET /api/store/expenses/export
 *
 * ARGUS #396 - the Expenses header action is the register the user sees, not
 * the first active petty-cash fund's audit trail. This endpoint returns every
 * matching expense (bank, cash and unlinked accounts alike) for the current
 * category and inclusive date-range filters. Pagination is intentionally
 * ignored: a register download covers the whole filtered set.
 */
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
    const category = searchParams.get('category') ?? undefined;
    if (category && !EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown expense category' } },
        { status: 400 },
      );
    }

    const expenses = await getExpensesForExport(tenantId, {
      category,
      search: normalizeExpenseSearch(searchParams.get('search')),
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    });

    const csv = buildExpenseRegisterCsv(expenses);
    return csvDownloadResponse(csv, expenseRegisterFilename());
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/expenses/export');
  }
}
