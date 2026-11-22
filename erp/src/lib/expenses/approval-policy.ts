import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';
import type { UserRole } from '@/generated/prisma/client';

/**
 * ARGUS #397 - approval policy for expense writes.
 *
 * The Expense model has no status/approved-by column, so this policy can only
 * gate WHO may make a write, not record a separate approver. It is the
 * strongest control available without a schema migration:
 *
 * - creating an expense is allowed with `expense:create` up to the configured
 *   threshold;
 * - creating an expense ABOVE the threshold requires `expense:approve`;
 * - editing or deleting ANY existing expense requires `expense:approve`.
 *
 * The residual gap (an approved write is still self-service at the data level,
 * and there is no pending/rejected state) is documented in
 * `docs/expenses-approval-policy.md`.
 */
export const DEFAULT_EXPENSE_APPROVAL_THRESHOLD = 5_000;

export type ExpenseWriteAction = 'create' | 'update' | 'delete';

export interface ExpenseUserLike {
  role?: UserRole;
  permissions?: unknown;
}

export interface ExpenseApprovalDecision {
  /** Whether this write falls under the approval policy. */
  requiresApproval: boolean;
  /** Whether the actor may proceed with the write. */
  allowed: boolean;
  /** Stable denial reason for the API envelope, when denied. */
  reason: string | null;
}

/**
 * Resolve the configured threshold. Invalid, negative or missing values fall
 * back to the default so a typo in the environment cannot silently disable the
 * control.
 */
export function resolveExpenseApprovalThreshold(
  raw: string | number | null | undefined = process.env.EXPENSE_APPROVAL_THRESHOLD,
): number {
  if (raw === null || raw === undefined) {
    return DEFAULT_EXPENSE_APPROVAL_THRESHOLD;
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return DEFAULT_EXPENSE_APPROVAL_THRESHOLD;
  }
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_EXPENSE_APPROVAL_THRESHOLD;
  }
  return parsed;
}

export function expenseRequiresApproval(
  action: ExpenseWriteAction,
  amount: number | null | undefined,
  threshold: number = DEFAULT_EXPENSE_APPROVAL_THRESHOLD,
): boolean {
  // Edits and deletes change an already-recorded spend, so they are always an
  // approval decision regardless of value.
  if (action === 'update' || action === 'delete') {
    return true;
  }
  return typeof amount === 'number' && Number.isFinite(amount) && amount > threshold;
}

export function authorizeExpenseWrite(input: {
  user: ExpenseUserLike | null | undefined;
  action: ExpenseWriteAction;
  amount?: number | null | undefined;
  threshold?: number | undefined;
}): ExpenseApprovalDecision {
  const threshold = input.threshold ?? DEFAULT_EXPENSE_APPROVAL_THRESHOLD;
  const requiresApproval = expenseRequiresApproval(
    input.action,
    input.amount,
    threshold,
  );

  if (!requiresApproval) {
    return { requiresApproval: false, allowed: true, reason: null };
  }

  const allowed = hasPermission(input.user, PERMISSIONS.EXPENSE.approveExpense);
  if (allowed) {
    return { requiresApproval: true, allowed: true, reason: null };
  }

  const reason =
    input.action === 'create'
      ? `Expenses above Rs ${threshold.toLocaleString('en-LK')} require manager approval`
      : 'Editing or deleting an expense requires manager approval';

  return { requiresApproval: true, allowed: false, reason };
}
