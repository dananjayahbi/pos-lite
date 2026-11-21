import { PERMISSIONS } from '@/lib/constants/permissions';

/**
 * Payment-account access split (ARGUS #427).
 *
 * `payment_account:view` exists so operational roles (cashier, stock clerk)
 * can choose a destination account in POS/expense flows. It must not expose the
 * management page, balances, ledger or cash-flow report. Those require the
 * stronger `managePaymentAccount` key, which is derived to OWNER/MANAGER only.
 */
export const PAYMENT_ACCOUNT_LEDGER_PERMISSION =
  PERMISSIONS.PAYMENT_ACCOUNT.managePaymentAccount;

export const PAYMENT_ACCOUNT_DESTINATION_PERMISSION =
  PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount;

export interface PaymentAccountCapabilities {
  /** Full account list, balances, ledger, cash-flow report and page. */
  canViewLedger: boolean;
  canManageAccounts: boolean;
  canTransfer: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canClose: boolean;
  /** Safe id/name/type list for POS/expense destination pickers. */
  canUseDestinationPicker: boolean;
}

export function resolvePaymentAccountCapabilities(
  permissions: Iterable<string>,
): PaymentAccountCapabilities {
  const held = permissions instanceof Set ? permissions : new Set(permissions);
  const canManageAccounts = held.has(PAYMENT_ACCOUNT_LEDGER_PERMISSION);

  return {
    canViewLedger: canManageAccounts,
    canManageAccounts,
    canTransfer: held.has(PERMISSIONS.PAYMENT_ACCOUNT.transferFunds),
    canDeposit: held.has(PERMISSIONS.PAYMENT_ACCOUNT.depositFunds),
    // There is no separate withdraw key; it is the same money-out capability
    // family as deposit/transfer and is currently guarded by depositFunds.
    canWithdraw: held.has(PERMISSIONS.PAYMENT_ACCOUNT.depositFunds),
    canClose: held.has(PERMISSIONS.PAYMENT_ACCOUNT.closePaymentAccount),
    canUseDestinationPicker:
      canManageAccounts || held.has(PAYMENT_ACCOUNT_DESTINATION_PERMISSION),
  };
}
