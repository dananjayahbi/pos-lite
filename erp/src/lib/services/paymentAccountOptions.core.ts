/**
 * Account-option selection for the deposit/withdraw dialogs (ARGUS #431).
 *
 * The petty-cash account's balance is owned by the fund service, so
 * `postLedgerEntries` rejects any incidental movement on it with a 409. The
 * deposit "from" and withdrawal "to" pickers used to offer it anyway, so a user
 * could choose a dead option and only learn the block on submit.
 *
 * Petty cash stays selectable as a transfer/close destination because those two
 * flows explicitly opt in server-side. This helper is pure so the UI filter and
 * its test share exactly the same rule.
 */

export interface AccountOptionCandidate {
  id: string;
  status: string;
  pettyCashFundId?: string | null | undefined;
}

export interface AccountOptionFilters {
  /** Hide the account on the other side of the movement. */
  excludeAccountId?: string | undefined;
  /** Hide fund-managed petty-cash accounts (deposit source / withdraw target). */
  excludePettyCash?: boolean | undefined;
}

export function selectPaymentAccountOptions<T extends AccountOptionCandidate>(
  accounts: readonly T[],
  filters: AccountOptionFilters = {},
): T[] {
  return accounts.filter((account) => {
    if (account.status !== 'ACTIVE') return false;
    if (filters.excludeAccountId && account.id === filters.excludeAccountId) return false;
    if (filters.excludePettyCash && account.pettyCashFundId) return false;
    return true;
  });
}
