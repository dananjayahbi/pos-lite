'use client';

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatLKR } from '@/lib/format';

export interface PettyCashFundOption {
  id: string;
  name: string;
  /** Live fund balance; when known, the form shows headroom and warns on overdraft. */
  currentBalance?: number;
}

interface PettyCashFundStatusProps {
  fund: PettyCashFundOption | null | undefined;
  /** Derived from the selected payment account, never chosen separately. */
  fundId: string | null | undefined;
  amount: number | undefined;
  overdrawApproved: boolean;
  onOverdrawChange: (approved: boolean) => void;
  canApproveOverdraw?: boolean;
}

/**
 * ARGUS #400 - a read-only status panel, not a second selector.
 *
 * The Payment Account select is the single authoritative control: picking the
 * fund's account links the fund, picking another account clears it, and
 * picking "No account" unlinks both. This panel only surfaces the resulting
 * fund and the overdraft warning/approval.
 */
export function PettyCashFundPicker({
  fund,
  fundId,
  amount,
  overdrawApproved,
  onOverdrawChange,
  canApproveOverdraw = true,
}: PettyCashFundStatusProps) {
  if (!fund || fundId !== fund.id) return null;

  const balance = fund.currentBalance;
  const wouldOverdraw =
    typeof balance === 'number' && typeof amount === 'number' && amount > balance;
  const shortfall = wouldOverdraw ? amount - (balance ?? 0) : 0;

  // The approval checkbox is only meaningful while an overdraft is pending —
  // clear it as soon as the amount fits (or the fund is unlinked).
  useEffect(() => {
    if (!wouldOverdraw && overdrawApproved) onOverdrawChange(false);
  }, [wouldOverdraw, overdrawApproved, onOverdrawChange]);

  return (
    <div className="space-y-2 rounded-md border border-mist bg-linen/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Petty Cash Fund</Label>
        <span className="text-sm font-medium text-espresso">{fund.name}</span>
      </div>
      {typeof balance === 'number' && (
        <p className="text-xs text-espresso/70">
          Available balance: <span className="font-medium">{formatLKR(balance)}</span>
        </p>
      )}
      <p className="text-xs text-sand-ink">
        Change the Payment Account above to link or unlink petty cash.
      </p>

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
