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
import { AccountTypeBadge } from './AccountTypeBadge';
import { AmountDateNoteFields } from './AmountDateNoteFields';
import { DialogSubmitRow } from './DialogSubmitRow';
import { formatRupee } from '@/lib/format';
import { parseMoney, todayIso } from './paymentAccountLabels';
import type { DepositPayload, PaymentAccount } from './paymentAccountTypes';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PaymentAccount[];
  /** The account receiving the money. */
  account: PaymentAccount | null;
  onSubmit: (payload: DepositPayload) => Promise<void>;
}

export function DepositDialog({
  open,
  onOpenChange,
  accounts,
  account,
  onSubmit,
}: DepositDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && account && (
          <DepositForm
            account={account}
            accounts={accounts}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DepositFormProps {
  account: PaymentAccount;
  accounts: PaymentAccount[];
  onSubmit: (payload: DepositPayload) => Promise<void>;
  onCancel: () => void;
}

function DepositForm({ account, accounts, onSubmit, onCancel }: DepositFormProps) {
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const source = accounts.find((candidate) => candidate.id === fromAccountId) ?? null;
  const sourceBalance = parseMoney(source?.balance ?? null);
  const amountNumber = parseMoney(amount);
  const amountValid = amountNumber !== null && amountNumber > 0;
  // A nominated source account is debited, so it must cover the deposit.
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
        fromAccountId,
        amount: amountNumber,
        ...(entryDate ? { entryDate } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Deposit failed');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Deposit</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          Money coming into this account. Leave the source empty when the money
          enters the business from outside.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-mist bg-linen/40 p-3">
          <p className="font-body text-[11px] uppercase tracking-wide text-mist">
            Target account
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-espresso">
                {account.name}
              </p>
              {account.accountNumber && (
                <p className="font-mono text-[11px] text-sand">{account.accountNumber}</p>
              )}
            </div>
            <AccountTypeBadge type={account.type} />
          </div>
          <p className="mt-2 font-body text-xs text-sand">
            Current balance:{' '}
            <span className="font-mono text-espresso">{formatRupee(account.balance)}</span>
          </p>
        </div>

        <div>
          <Label htmlFor="deposit-from" className="font-body">
            Deposit from <span className="font-normal text-mist">(optional)</span>
          </Label>
          <div className="mt-1.5">
            <AccountSelect
              id="deposit-from"
              accounts={accounts}
              value={fromAccountId}
              onValueChange={setFromAccountId}
              placeholder="Outside the business / owner's cash"
              excludeAccountId={account.id}
              noneLabel="Outside the business"
              disabled={isSubmitting}
              className="w-full border-mist"
            />
          </div>
          {source && sourceBalance !== null && (
            <p className="mt-1 font-body text-[11px] text-sand">
              Available in {source.name}: {formatRupee(sourceBalance)}
            </p>
          )}
        </div>

        <AmountDateNoteFields
          idPrefix="deposit"
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
          {...(source ? { amountHint: `Debited from ${source.name}` } : {})}
          disabled={isSubmitting}
        />

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel="Record deposit"
          pendingLabel="Recording…"
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
        />
      </form>
    </>
  );
}
