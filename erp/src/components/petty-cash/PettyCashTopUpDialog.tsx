'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AccountSelect } from '@/components/payment-accounts/AccountSelect';
import { AmountDateNoteFields } from '@/components/payment-accounts/AmountDateNoteFields';
import { DialogSubmitRow } from '@/components/payment-accounts/DialogSubmitRow';
import { formatRupee } from '@/lib/format';
import { parseMoney, todayIso } from '@/components/payment-accounts/paymentAccountLabels';
import type { PaymentAccount } from '@/components/payment-accounts/paymentAccountTypes';

export interface PettyCashTopUpPayload {
  amount: number;
  sourceAccountId: string | null;
  description?: string;
  entryDate: string;
}

interface PettyCashTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundName: string;
  paymentAccountId: string | null | undefined;
  accounts: PaymentAccount[];
  onSubmit: (payload: PettyCashTopUpPayload) => Promise<void>;
}

/**
 * "Add Cash In" — tops up the petty-cash float. The source account is
 * optional: when chosen, both ledgers move (bank/cash → petty cash); when left
 * empty, the cash is recorded as entering the business from outside.
 */
export function PettyCashTopUpDialog({
  open,
  onOpenChange,
  fundName,
  paymentAccountId,
  accounts,
  onSubmit,
}: PettyCashTopUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <TopUpForm
            fundName={fundName}
            paymentAccountId={paymentAccountId}
            accounts={accounts}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TopUpFormProps {
  fundName: string;
  paymentAccountId: string | null | undefined;
  accounts: PaymentAccount[];
  onSubmit: (payload: PettyCashTopUpPayload) => Promise<void>;
  onCancel: () => void;
}

function TopUpForm({
  fundName,
  paymentAccountId,
  accounts,
  onSubmit,
  onCancel,
}: TopUpFormProps) {
  const [sourceAccountId, setSourceAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const source = accounts.find((candidate) => candidate.id === sourceAccountId) ?? null;
  const sourceBalance = parseMoney(source?.balance ?? null);
  const amountNumber = parseMoney(amount);
  const amountValid = amountNumber !== null && amountNumber > 0;
  const exceedsSource =
    amountValid && sourceBalance !== null && amountNumber !== null && amountNumber > sourceBalance;

  const canSubmit = amountValid && !exceedsSource && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amountNumber === null) return;
    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        amount: amountNumber,
        sourceAccountId,
        ...(note.trim() ? { description: note.trim() } : {}),
        entryDate,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Top-up failed');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Add Cash In</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist-ink">
          Top up the petty-cash float. The amount is added to Current Balance immediately
          and recorded in the Linked Expenses table.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-mist bg-linen/40 p-3">
          <p className="font-body text-[11px] uppercase tracking-wide text-mist-ink">Fund</p>
          <p className="mt-1 font-display text-sm font-semibold text-espresso">{fundName}</p>
          <p className="mt-1 font-body text-xs text-sand-ink">
            Posts to the linked payment account and the Cash Flow ledger.
          </p>
        </div>

        <div>
          <Label htmlFor="petty-cash-topup-source" className="font-body">
            From account <span className="font-normal text-mist-ink">(optional)</span>
          </Label>
          <div className="mt-1.5">
            <AccountSelect
              id="petty-cash-topup-source"
              accounts={accounts}
              value={sourceAccountId}
              onValueChange={setSourceAccountId}
              placeholder="Outside the business / bank transfer"
              {...(paymentAccountId ? { excludeAccountId: paymentAccountId } : {})}
              noneLabel="Outside the business / bank transfer"
              disabled={isSubmitting}
              className="w-full border-mist"
            />
          </div>
          <p className="mt-1 font-body text-[11px] text-sand-ink">
            {source
              ? `Recorded as “Petty Cash Replenished from ${source.name}” unless you add a note.`
              : 'Recorded as “Petty Cash Replenished” unless you add a note.'}
          </p>
          {source && sourceBalance !== null && (
            <p className="mt-1 font-body text-[11px] text-sand-ink">
              Available in {source.name}: {formatRupee(sourceBalance)}
            </p>
          )}
        </div>

        <AmountDateNoteFields
          idPrefix="petty-cash-topup"
          amount={amount}
          onAmountChange={setAmount}
          entryDate={entryDate}
          onEntryDateChange={setEntryDate}
          note={note}
          onNoteChange={setNote}
          amountError={
            exceedsSource && sourceBalance !== null
              ? `Amount exceeds the available balance of ${formatRupee(sourceBalance)}`
              : undefined
          }
          amountHint="Added to the petty cash Current Balance"
          disabled={isSubmitting}
        />

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel="Add cash"
          pendingLabel="Adding…"
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
        />
      </form>
    </>
  );
}
