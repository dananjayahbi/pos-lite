'use client';

import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupee } from '@/lib/format';

import { fetchPaymentAccountList } from './poApi';
import { poQueryKeys } from './poQueryKeys';

/**
 * Payment-account selector for a purchase order.
 *
 * Radix `Select` refuses an empty-string item value, so "decide later" is a
 * sentinel. Only ACTIVE accounts are offered — a closed account can no longer
 * be debited, and the API rejects it.
 */
export const NO_PAYMENT_ACCOUNT = '__none__';

interface POPaymentAccountFieldProps {
  value: string | null;
  onChange: (accountId: string | null) => void;
  /** Show the selected account's balance line. */
  showBalance?: boolean;
  disabled?: boolean | undefined;
  error?: string | undefined;
}

export function POPaymentAccountField({
  value,
  onChange,
  showBalance = true,
  disabled,
  error,
}: POPaymentAccountFieldProps) {
  const { data, isLoading } = useQuery({
    queryKey: poQueryKeys.paymentAccounts(),
    queryFn: fetchPaymentAccountList,
    staleTime: 30_000,
  });

  const accounts = (data?.accounts ?? []).filter((account) => account.status === 'ACTIVE');
  const selected = accounts.find((account) => account.id === value) ?? null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="po-payment-account">Payment Account</Label>
      <Select
        value={value ?? NO_PAYMENT_ACCOUNT}
        onValueChange={(next) => onChange(next === NO_PAYMENT_ACCOUNT ? null : next)}
        {...(disabled !== undefined ? { disabled } : {})}
      >
        <SelectTrigger id="po-payment-account" className="w-full">
          <SelectValue placeholder={isLoading ? 'Loading accounts…' : 'Select an account'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PAYMENT_ACCOUNT}>Decide when paying</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showBalance && selected ? (
        <p className="flex items-center gap-1 text-xs text-mist">
          <Wallet className="h-3 w-3" />
          Balance: <span className="font-mono">{formatRupee(selected.balance)}</span>
        </p>
      ) : (
        <p className="text-xs text-mist">
          {accounts.length === 0 && !isLoading
            ? 'No active payment accounts — create one under Payment Accounts.'
            : 'Which account the payable will be settled from.'}
        </p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
