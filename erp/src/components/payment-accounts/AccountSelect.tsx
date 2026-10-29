'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  /** Label for an explicit "leave empty" option. Omit to force a selection. */
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function AccountSelect({
  accounts,
  value,
  onValueChange,
  placeholder,
  excludeAccountId,
  noneLabel,
  disabled,
  id,
  className,
}: AccountSelectProps) {
  const options = accounts.filter(
    (account) => account.status === 'ACTIVE' && account.id !== excludeAccountId,
  );

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
        {options.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
