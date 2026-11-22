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
import { Button } from '@/components/ui/button';
import { AccountSelect } from '@/components/payment-accounts/AccountSelect';
import { AmountDateNoteFields } from '@/components/payment-accounts/AmountDateNoteFields';
import { DialogSubmitRow } from '@/components/payment-accounts/DialogSubmitRow';
import { formatRupee } from '@/lib/format';
import { parseMoney, todayIso } from '@/components/payment-accounts/paymentAccountLabels';
import type { PaymentAccount } from '@/components/payment-accounts/paymentAccountTypes';
import type { TopUpSourceType } from '@/lib/validators/petty-cash.validators';

export interface PettyCashTopUpPayload {
  amount: number;
  sourceType: TopUpSourceType;
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
 * "Add Cash In" - tops up the petty-cash float. ARGUS #413 makes the source
 * path explicit: external cash (no bank debit) or a transfer from a chosen
 * account (both ledgers move). A future date is rejected because the balance
 * is incremented immediately.
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
  const [sourceType, setSourceType] = useState<TopUpSourceType>('EXTERNAL');
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
    sourceType === 'ACCOUNT' &&
    amountValid &&
    sourceBalance !== null &&
    amountNumber !== null &&
    amountNumber > sourceBalance;
  const sourceValid = sourceType === 'EXTERNAL' || Boolean(sourceAccountId);
  const futureDate = entryDate > todayIso();

  const canSubmit =
    amountValid && !exceedsSource && sourceValid && !futureDate && !isSubmitting;

  const chooseExternal = () => {
    setSourceType('EXTERNAL');
    setSourceAccountId(null);
  };
  const chooseTransfer = () => setSourceType('ACCOUNT');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amountNumber === null) return;
    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        amount: amountNumber,
        sourceType,
        sourceAccountId: sourceType === 'ACCOUNT' ? sourceAccountId : null,
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
          Top up the petty-cash float. Choose external cash or a transfer from an account; the
          amount is added to Current Balance immediately. Only today or past dates are accepted.
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

        <div className="space-y-2">
          <Label>Source</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={chooseExternal}
              disabled={isSubmitting}
              className={`rounded-lg border p-3 text-left ${
                sourceType === 'EXTERNAL'
                  ? 'border-espresso bg-linen/50'
                  : 'border-mist hover:border-espresso/40'
              }`}
            >
              <span className="block font-body text-sm font-semibold text-espresso">
                External cash
              </span>
              <span className="mt-1 block font-body text-xs text-sand-ink">
                Cash enters from outside the business. No bank account is debited.
              </span>
            </button>
            <button
              type="button"
              onClick={chooseTransfer}
              disabled={isSubmitting}
              className={`rounded-lg border p-3 text-left ${
                sourceType === 'ACCOUNT'
                  ? 'border-espresso bg-linen/50'
                  : 'border-mist hover:border-espresso/40'
              }`}
            >
              <span className="block font-body text-sm font-semibold text-espresso">
                Transfer from account
              </span>
              <span className="mt-1 block font-body text-xs text-sand-ink">
                Debits the chosen bank or cash account and credits petty cash.
              </span>
            </button>
          </div>
        </div>

        {sourceType === 'ACCOUNT' && (
          <div>
            <Label htmlFor="petty-cash-topup-source" className="font-body">
              Source account
            </Label>
            <div className="mt-1.5">
              <AccountSelect
                id="petty-cash-topup-source"
                accounts={accounts}
                value={sourceAccountId}
                onValueChange={setSourceAccountId}
                placeholder="Select the account the transfer came from"
                {...(paymentAccountId ? { excludeAccountId: paymentAccountId } : {})}
                disabled={isSubmitting}
                className="w-full border-mist"
              />
            </div>
            <p className="mt-1 font-body text-[11px] text-sand-ink">
              {source
                ? `Recorded as “Petty Cash Replenished from ${source.name}” unless you add a note.`
                : 'Select a source account. The transfer is recorded in both account ledgers.'}
            </p>
            {source && sourceBalance !== null && (
              <p className="mt-1 font-body text-[11px] text-sand-ink">
                Available in {source.name}: {formatRupee(sourceBalance)}
              </p>
            )}
          </div>
        )}

        {sourceType === 'EXTERNAL' && (
          <p className="rounded-md border border-mist bg-linen/30 p-3 font-body text-xs text-sand-ink">
            Recorded as “Petty Cash Replenished” unless you add a note. No bank or cash account is
            debited, so this must be real cash entering the business.
          </p>
        )}

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
          amountHint={
            sourceType === 'ACCOUNT'
              ? 'Debited from the selected account and added to petty cash'
              : 'Added to petty cash from external cash'
          }
          dateMax={todayIso()}
          dateError={futureDate ? 'Date cannot be in the future' : undefined}
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
