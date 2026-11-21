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
