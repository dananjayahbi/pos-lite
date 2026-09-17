'use client';

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { formatLKR } from '@/lib/format';

export interface PettyCashFundOption {
  id: string;
  name: string;
  /** Live fund balance; when known, the form shows headroom and warns on overdraft. */
  currentBalance?: number;
}

interface PettyCashFundPickerProps {
  fund: PettyCashFundOption | null | undefined;
  fundId: string | undefined;
  amount: number | undefined;
  overdrawApproved: boolean;
  onFundChange: (fundId: string | undefined) => void;
  onOverdrawChange: (approved: boolean) => void;
  canApproveOverdraw?: boolean;
}

/**
 * M19-01 (D2) — petty-cash fund picker for the expense form.
 *
 * Shows the fund's live balance next to the picker and, when the entered amount
 * would overdraw the float, surfaces the shortfall and offers an explicit
 * manager "approve overdraft" checkbox. The server still enforces the policy
 * (422 `PETTY_CASH_OVERDRAW` unless `overdrawApproved` rides along with a
 * manager permission) — this control only mirrors the contract in the UI.
 */
export function PettyCashFundPicker({
  fund,
  fundId,
  amount,
  overdrawApproved,
  onFundChange,
  onOverdrawChange,
  canApproveOverdraw = true,
}: PettyCashFundPickerProps) {
  if (!fund) return null;

  const linked = fundId === fund.id;
  const balance = fund.currentBalance;
  const wouldOverdraw =
    linked && typeof balance === 'number' && typeof amount === 'number' && amount > balance;
  const shortfall = wouldOverdraw ? amount - (balance ?? 0) : 0;

  // The approval checkbox is only meaningful while an overdraft is pending —
  // clear it as soon as the amount fits (or the fund is unlinked).
  useEffect(() => {
    if (!wouldOverdraw && overdrawApproved) onOverdrawChange(false);
  }, [wouldOverdraw, overdrawApproved, onOverdrawChange]);

  return (
    <div className="space-y-2">
      <Label>Petty Cash Fund (optional)</Label>
      <Select
        value={fundId ?? ''}
        onValueChange={(v) => onFundChange(v === 'none' ? undefined : v)}
      >
        <SelectTrigger className="border-mist">
          <SelectValue placeholder="Not linked" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not linked</SelectItem>
          <SelectItem value={fund.id}>
            {fund.name}
            {typeof balance === 'number' ? ` — ${formatLKR(balance)} available` : ''}
          </SelectItem>
        </SelectContent>
      </Select>

      {linked && typeof balance === 'number' && (
        <p className="text-xs text-espresso/70">
          Available balance: <span className="font-medium">{formatLKR(balance)}</span>
        </p>
      )}

      {wouldOverdraw && (
        <div className="rounded-md border border-terracotta/40 bg-terracotta/5 p-3">
          <p className="text-sm text-terracotta">
            This expense exceeds the fund balance by {formatLKR(shortfall)}. A manager must approve
            the overdraft.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-espresso">
            <Checkbox
              checked={overdrawApproved}
              disabled={!canApproveOverdraw}
              onCheckedChange={(checked) => onOverdrawChange(checked === true)}
            />
            Approve overdraft (manager)
          </label>
        </div>
      )}
    </div>
  );
}