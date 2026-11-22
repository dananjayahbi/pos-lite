import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';
import type { UserRole } from '@/generated/prisma/client';

interface PettyCashUserLike {
  role?: UserRole;
  permissions?: unknown;
}

/**
 * ARGUS #409 - one server-side decision for the Petty Cash page.
 *
 * The page previously rendered for any signed-in role while the APIs returned
 * 403. The same flags now hide actions the actor cannot use:
 * - `canManage` gates Add Cash In, category edits and setup;
 * - `canManageSettings` gates the owner-only fund settings dialog;
 * - `canCreateExpense` gates the Add Expense deep link.
 */
export interface PettyCashPageAccess {
  canView: boolean;
  canManage: boolean;
  canManageSettings: boolean;
  canCreateExpense: boolean;
}

export function resolvePettyCashPageAccess(
  user: PettyCashUserLike | null | undefined,
): PettyCashPageAccess {
  return {
    canView: hasPermission(user, PERMISSIONS.PETTY_CASH.viewPettyCash),
    canManage: hasPermission(user, PERMISSIONS.PETTY_CASH.managePettyCash),
    canManageSettings: hasPermission(user, PERMISSIONS.PETTY_CASH.manageFundSettings),
    canCreateExpense: hasPermission(user, PERMISSIONS.EXPENSE.createExpense),
  };
}
