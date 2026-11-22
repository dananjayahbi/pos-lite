import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';
import type { UserRole } from '@/generated/prisma/client';

interface ExpenseUserLike {
  role?: UserRole;
  permissions?: unknown;
}

/**
 * ARGUS #398 - one decision object for the Expenses page.
 *
 * The list API already required `expense:view`; the page did not, so an
 * unauthorised role (or a user whose overrides granted a narrow key) could open
 * the shell and the Add Expense form while every fetch returned 403.
 *
 * The page calls this on the server to decide whether to render at all, and the
 * client uses the same flags to hide actions the actor cannot perform. Keeping
 * the checks in one pure helper means the page and the controls cannot drift.
 */
export interface ExpensePageAccess {
  canView: boolean;
  canCreate: boolean;
  canApprove: boolean;
}

export function resolveExpensePageAccess(
  user: ExpenseUserLike | null | undefined,
): ExpensePageAccess {
  return {
    canView: hasPermission(user, PERMISSIONS.EXPENSE.viewExpense),
    canCreate: hasPermission(user, PERMISSIONS.EXPENSE.createExpense),
    canApprove: hasPermission(user, PERMISSIONS.EXPENSE.approveExpense),
  };
}
