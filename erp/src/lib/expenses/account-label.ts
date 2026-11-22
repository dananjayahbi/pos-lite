/**
 * ARGUS #399 - the Account column must never be blank for a fund-linked spend.
 *
 * An expense can name a payment account directly, or it can be linked to a
 * petty-cash fund whose own payment account settles the spend. When the fund
 * exists but `paymentAccountId` is null, the list/detail used to render "-"
 * even though the money clearly left the fund's account. This helper resolves
 * the visible label and a consistent link target for both surfaces.
 */
export type ExpenseAccountSource = 'ACCOUNT' | 'PETTY_CASH' | 'NONE';

export interface ExpenseAccountRefs {
  paymentAccountId?: string | null | undefined;
  paymentAccount?: { id?: string | null; name?: string | null } | null | undefined;
  pettyCashFundId?: string | null | undefined;
  pettyCashFund?: { id?: string | null; name?: string | null } | null | undefined;
}

export interface ExpenseAccountLookup {
  accountNameById?: ReadonlyMap<string, string> | Record<string, string> | undefined;
  fundNameById?: ReadonlyMap<string, string> | Record<string, string> | undefined;
}

export interface ExpenseAccountLabel {
  label: string;
  source: ExpenseAccountSource;
  href: string | null;
}

export const EXPENSE_PAYMENT_ACCOUNTS_HREF = '/payment-accounts';
export const EXPENSE_PETTY_CASH_HREF = '/petty-cash';
export const EXPENSE_ACCOUNT_EMPTY_LABEL = '-';

function lookupName(
  lookup: ReadonlyMap<string, string> | Record<string, string> | undefined,
  id: string,
): string | null {
  if (!lookup) return null;
  const value =
    lookup instanceof Map ? lookup.get(id) : (lookup as Record<string, string>)[id];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function resolveExpenseAccountLabel(
  expense: ExpenseAccountRefs,
  lookup: ExpenseAccountLookup = {},
): ExpenseAccountLabel {
  const accountId = expense.paymentAccountId ?? expense.paymentAccount?.id ?? null;
  if (accountId) {
    const name =
      (expense.paymentAccount?.name?.trim() || null) ??
      lookupName(lookup.accountNameById, accountId);
    return {
      label: name ?? 'Linked account',
      source: 'ACCOUNT',
      href: EXPENSE_PAYMENT_ACCOUNTS_HREF,
    };
  }

  const fundId = expense.pettyCashFundId ?? expense.pettyCashFund?.id ?? null;
  if (fundId) {
    const name =
      (expense.pettyCashFund?.name?.trim() || null) ??
      lookupName(lookup.fundNameById, fundId);
    return {
      label: name ?? 'Petty cash fund',
      source: 'PETTY_CASH',
      href: EXPENSE_PETTY_CASH_HREF,
    };
  }

  return {
    label: EXPENSE_ACCOUNT_EMPTY_LABEL,
    source: 'NONE',
    href: null,
  };
}
