/**
 * ARGUS #205/#206 — stock-take role and status policy.
 *
 * Pure so the routes, the session page and the list dialog all agree on who
 * may count, complete and cancel. Permission strings are resolved by the
 * caller (`stock:take` / `stock:take:approve`); this module only encodes the
 * rules.
 */

export interface StockTakePolicyInput {
  status: string | null | undefined;
  userId: string;
  initiatedById: string;
  /** Holds `stock:take`. */
  canConduct: boolean;
  /** Holds `stock:take:approve`. */
  canApprove: boolean;
}

/** Counting is only possible on an in-progress session with `stock:take`. */
export function canEditStockTake(input: {
  status: string | null | undefined;
  canConduct: boolean;
}): boolean {
  return input.canConduct && input.status === 'IN_PROGRESS';
}

/** Completing is the initiator's step; a manager cannot submit someone else's count. */
export function canCompleteStockTake(input: StockTakePolicyInput): boolean {
  return (
    canEditStockTake(input) &&
    input.userId === input.initiatedById
  );
}

/**
 * Cancelling only discards counted data, so it never changes stock. The
 * initiator may discard their own session; an approver may discard any
 * in-progress session. Everyone else is refused.
 */
export function canCancelStockTake(input: StockTakePolicyInput): boolean {
  // An approver may discard a stale in-progress or pending-approval session
  // (ARGUS #147); the initiator may discard their own in-progress session.
  if (input.status === 'IN_PROGRESS') {
    if (input.canApprove) return true;
    return input.canConduct && input.userId === input.initiatedById;
  }
  if (input.status === 'PENDING_APPROVAL') {
    return input.canApprove;
  }
  return false;
}

/**
 * ARGUS #187 (BUG-43) - maker-checker for approval.
 *
 * The approver needs `stock:take:approve`, the session must be waiting for
 * approval, and the approver must not be the user who initiated the count.
 * There is no documented override: an OWNER who counted must hand the session
 * to a different approver (or cancel it and start again).
 */
export function canApproveStockTake(input: StockTakePolicyInput): boolean {
  return (
    input.canApprove &&
    input.status === 'PENDING_APPROVAL' &&
    input.userId !== input.initiatedById
  );
}

/**
 * ARGUS #187 (BUG-42) - counted quantities are non-negative integers.
 *
 * The PATCH validator enforces this on write, but legacy rows or a direct
 * service/database path could still hold a negative, fractional or NaN count.
 * Completion and approval refuse to act on such a row instead of letting it
 * become a stock correction.
 */
export function isCountedQuantityValid(
  countedQuantity: number | null | undefined,
): boolean {
  if (countedQuantity === null || countedQuantity === undefined) return true;
  return Number.isInteger(countedQuantity) && countedQuantity >= 0;
}

export interface CountedQuantityRow {
  variantId: string;
  countedQuantity: number | null;
}

/**
 * Rows whose counted quantity cannot be used. Empty means the session is safe
 * to complete or approve. `label` is used in the typed error message.
 */
export function invalidCountedQuantityRows(
  rows: readonly CountedQuantityRow[],
): Array<CountedQuantityRow & { label: string }> {
  const invalid: Array<CountedQuantityRow & { label: string }> = [];
  for (const row of rows) {
    if (!isCountedQuantityValid(row.countedQuantity)) {
      invalid.push({
        ...row,
        label: `${row.variantId}=${String(row.countedQuantity)}`,
      });
    }
  }
  return invalid;
}

export type StockTakeCancelDisposition = 'discard' | 'reject';

/**
 * Cancellation is discard-only (ARGUS #206). A request that tries to apply
 * counted discrepancies is rejected; applying must go through
 * complete → approve (which enforces `stock:take:approve` and maker-checker).
 */
export function cancelDisposition(
  requestedAction: string | null | undefined,
): StockTakeCancelDisposition {
  return requestedAction === 'apply' ? 'reject' : 'discard';
}
