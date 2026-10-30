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
import { AccountSelect } from './AccountSelect';
import { AmountDateNoteFields } from './AmountDateNoteFields';
import { DialogSubmitRow } from './DialogSubmitRow';
import { formatRupee } from '@/lib/format';
import { parseMoney, todayIso } from './paymentAccountLabels';
import type { PaymentAccount, TransferPayload } from './paymentAccountTypes';

interface FundTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PaymentAccount[];
  /** Preselected source — the card the dialog was opened from. */
  defaultFromAccountId?: string | undefined;
  onSubmit: (payload: TransferPayload) => Promise<void>;
}

export function FundTransferDialog({
  open,
  onOpenChange,
  accounts,
  defaultFromAccountId,
  onSubmit,
}: FundTransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <TransferForm
            accounts={accounts}
            {...(defaultFromAccountId ? { defaultFromAccountId } : {})}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TransferFormProps {
  accounts: PaymentAccount[];
  defaultFromAccountId?: string;
  onSubmit: (payload: TransferPayload) => Promise<void>;
  onCancel: () => void;
}

function TransferForm({
  accounts,
  defaultFromAccountId,
  onSubmit,
  onCancel,
}: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState<string | null>(
    defaultFromAccountId ?? null,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const source = accounts.find((account) => account.id === fromAccountId) ?? null;
  const sourceBalance = parseMoney(source?.balance ?? null);
  const amountNumber = parseMoney(amount);
  const amountValid = amountNumber !== null && amountNumber > 0;
  const exceedsBalance =
    amountValid && sourceBalance !== null && amountNumber > sourceBalance;
  const sameAccount = fromAccountId !== null && fromAccountId === toAccountId;

  const canSubmit =
    fromAccountId !== null &&
    toAccountId !== null &&
    amountValid &&
    !exceedsBalance &&
    !sameAccount &&
    !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amountNumber === null || fromAccountId === null || toAccountId === null) {
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        fromAccountId,
        toAccountId,
        amount: amountNumber,
        ...(entryDate ? { entryDate } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Transfer failed');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Fund Transfer</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          Move money between two accounts. Both legs post to the ledger in one
          transaction.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="transfer-from" className="font-body">
            From account
          </Label>
          <div className="mt-1.5">
            <AccountSelect
              id="transfer-from"
              accounts={accounts}
              value={fromAccountId}
              onValueChange={(next) => {
                setFromAccountId(next);
                if (next === toAccountId) setToAccountId(null);
              }}
              placeholder="Select source account"
              disabled={isSubmitting}
              className="w-full border-mist"
            />
          </div>
          {source && sourceBalance !== null && (
            <p className="mt-1 font-body text-[11px] text-sand">
              Available: {formatRupee(sourceBalance)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="transfer-to" className="font-body">
            To account
          </Label>
          <div className="mt-1.5">
            <AccountSelect
              id="transfer-to"
              accounts={accounts}
              value={toAccountId}
              onValueChange={setToAccountId}
              placeholder="Select destination account"
              {...(fromAccountId ? { excludeAccountId: fromAccountId } : {})}
              disabled={isSubmitting}
              className="w-full border-mist"
            />
          </div>
        </div>

        <AmountDateNoteFields
          idPrefix="transfer"
          amount={amount}
          onAmountChange={setAmount}
          entryDate={entryDate}
          onEntryDateChange={setEntryDate}
          note={note}
          onNoteChange={setNote}
          amountError={
            exceedsBalance && sourceBalance !== null
              ? `Amount exceeds the available balance of ${formatRupee(sourceBalance)}`
              : undefined
          }
          disabled={isSubmitting}
        />

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel="Transfer"
          pendingLabel="Transferring…"
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
        />
      </form>
    </>
  );
}
