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
