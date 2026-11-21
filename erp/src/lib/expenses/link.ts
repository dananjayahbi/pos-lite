/**
 * ARGUS #400 - the payment account is the authoritative expense link.
 *
 * A petty-cash fund always settles through its own payment account, so the two
 * IDs are not independent: choosing a fund forces its account, and choosing an
 * account that belongs to a fund implies that fund. Choosing "No account"
 * clears both. This module keeps that mapping pure so the form and the service
 * cannot disagree.
 */
export interface PaymentAccountLinkRef {
  id: string;
  pettyCashFundId?: string | null | undefined;
}

export interface ExpenseLinkSelection {
  paymentAccountId: string | null;
  pettyCashFundId: string | null;
}

export function linkForPaymentAccount(
  account: PaymentAccountLinkRef | null | undefined,
): ExpenseLinkSelection {
  if (!account) {
    return { paymentAccountId: null, pettyCashFundId: null };
  }
  return {
    paymentAccountId: account.id,
    pettyCashFundId: account.pettyCashFundId ?? null,
  };
}

/**
 * Normalize an update's link fields before fund/account resolution.
 *
 * An explicit `null` on either side means "unlinked" unless the other side was
 * also explicitly given a concrete replacement. This is what makes editing to
 * "Not linked" actually clear the fund (previously an omitted field kept the
 * old fund and reported success).
 */
export function resolveExpenseLinkUpdate(input: {
  oldFundId: string | null;
  oldAccountId: string | null;
  pettyCashFundId?: string | null | undefined;
  paymentAccountId?: string | null | undefined;
}): ExpenseLinkSelection {
  const fundProvided = input.pettyCashFundId !== undefined;
  const accountProvided = input.paymentAccountId !== undefined;

  let fundId = fundProvided ? (input.pettyCashFundId ?? null) : input.oldFundId;
  let accountId = accountProvided ? (input.paymentAccountId ?? null) : input.oldAccountId;

  if (
    fundProvided &&
    input.pettyCashFundId === null &&
    input.paymentAccountId === undefined
  ) {
    accountId = null;
  }
  if (
    accountProvided &&
    input.paymentAccountId === null &&
    input.pettyCashFundId === undefined
  ) {
    fundId = null;
  }

  return { paymentAccountId: accountId, pettyCashFundId: fundId };
}
