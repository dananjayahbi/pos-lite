'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { selectPaymentAccountOptions } from '@/lib/services/paymentAccountOptions.core';
import type { PaymentAccount } from './paymentAccountTypes';

/**
 * Radix `Select` refuses an empty string as an item value, so "no account"
 * needs a sentinel. `SelectValue` treats `''` as "nothing selected" and shows
 * the placeholder, which is why `value` is normalised below.
 */
export const NO_ACCOUNT = '__none__';

interface AccountSelectProps {
  accounts: PaymentAccount[];
  value: string | null;
  onValueChange: (accountId: string | null) => void;
  placeholder: string;
  /** Hide this account from the list (e.g. the source of a transfer). */
  excludeAccountId?: string;
  /**
   * Hide fund-managed petty-cash accounts. Deposit sources and withdrawal
   * destinations cannot be petty cash (the API rejects them), so offering the
   * option only produces a dead selection (ARGUS #431).
   */
  excludePettyCash?: boolean;
  /** Label for an explicit "leave empty" option. Omit to force a selection. */
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /**
   * Keep a saved value selectable even when it is no longer in `accounts`
   * (inactive account, filtered fetch). ARGUS #404: this prevents the edit
   * dialog from falling back to "Select account" for the fund account.
   */
  fallbackOption?: { id: string; label: string } | null;
}

export function AccountSelect({
  accounts,
  value,
  onValueChange,
  placeholder,
  excludeAccountId,
  excludePettyCash,
  noneLabel,
  disabled,
  id,
  className,
  fallbackOption,
}: AccountSelectProps) {
  const options = selectPaymentAccountOptions(accounts, {
    excludeAccountId,
    excludePettyCash,
  });

  // A saved value that cannot be found in the loaded options still needs a
  // label, otherwise Radix renders the placeholder for an existing selection.
  const fallback =
    fallbackOption &&
    value === fallbackOption.id &&
    !options.some((account) => account.id === fallbackOption.id)
      ? fallbackOption
      : null;

  return (
    <Select
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next === NO_ACCOUNT ? null : next)}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectTrigger id={id} className={className ?? 'w-full'} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel !== undefined && <SelectItem value={NO_ACCOUNT}>{noneLabel}</SelectItem>}
        {fallback && <SelectItem value={fallback.id}>{fallback.label}</SelectItem>}
        {options.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
