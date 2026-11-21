/**
 * Purchase-order approval separation (ARGUS #224).
 *
 * Creating a DRAFT is a create action; creating it as SENT (or moving a draft
 * to SENT / sending it on WhatsApp) commits money to the supplier and therefore
 * requires `purchase_order:approve`. The server enforces this and the UI hides
 * the send action from create-only roles.
 */
export type PurchaseOrderCreateStatus = 'DRAFT' | 'SENT';

export function canCreatePurchaseOrderWithStatus(
  status: PurchaseOrderCreateStatus | undefined,
  canApprove: boolean,
): boolean {
  return status !== 'SENT' || canApprove;
}

/**
 * A purchase order locks its financial fields and cancellation once money has
 * been applied (ARGUS #226). Changing the discount/lines afterwards left the
 * paid amount and `paidAt` describing a different order, and cancelling orphaned
 * the payment and its ledger credit.
 */
export function isPurchaseOrderFinanciallyLocked(paidTotal: number | string): boolean {
  return Number(paidTotal) > 0;
}
