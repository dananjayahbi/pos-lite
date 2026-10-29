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
import type { PaymentAccount, WithdrawalPayload } from './paymentAccountTypes';

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PaymentAccount[];
  /** The account the money leaves. */
  account: PaymentAccount | null;
  onSubmit: (payload: WithdrawalPayload) => Promise<void>;
}

export function WithdrawDialog({
  open,
  onOpenChange,
  accounts,
  account,
  onSubmit,
}: WithdrawDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && account && (
          <WithdrawForm
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

interface WithdrawFormProps {
  account: PaymentAccount;
  accounts: PaymentAccount[];
  onSubmit: (payload: WithdrawalPayload) => Promise<void>;
  onCancel: () => void;
}

function WithdrawForm({ account, accounts, onSubmit, onCancel }: WithdrawFormProps) {
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const available = parseMoney(account.balance) ?? 0;
  const amountNumber = parseMoney(amount);
  const amountValid = amountNumber !== null && amountNumber > 0;
  const exceedsBalance = amountValid && amountNumber !== null && amountNumber > available;

  const canSubmit = amountValid && !exceedsBalance && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amountNumber === null) return;
    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        toAccountId,
        amount: amountNumber,
        ...(entryDate ? { entryDate } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Withdrawal failed');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Withdraw</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          Money leaving this account. Leave the destination empty for cash taken
          out of the business.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-mist bg-linen/40 p-3">
          <p className="font-body text-[11px] uppercase tracking-wide text-mist">
            Source account
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
            Available balance:{' '}
            <span className="font-mono text-espresso">{formatRupee(account.balance)}</span>
          </p>
        </div>

        <div>
          <Label htmlFor="withdraw-to" className="font-body">
            Withdraw to <span className="font-normal text-mist">(optional)</span>
          </Label>
          <div className="mt-1.5">
            <AccountSelect
              id="withdraw-to"
              accounts={accounts}
              value={toAccountId}
              onValueChange={setToAccountId}
              placeholder="Cash out of the business"
              excludeAccountId={account.id}
              noneLabel="Cash out of the business"
              disabled={isSubmitting}
              className="w-full border-mist"
            />
          </div>
        </div>

        <AmountDateNoteFields
          idPrefix="withdraw"
          amount={amount}
          onAmountChange={setAmount}
          entryDate={entryDate}
          onEntryDateChange={setEntryDate}
          note={note}
          onNoteChange={setNote}
          amountError={
            exceedsBalance
              ? `Amount exceeds the available balance of ${formatRupee(account.balance)}`
              : undefined
          }
          amountHint={`Up to ${formatRupee(account.balance)} available`}
          disabled={isSubmitting}
        />

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel="Record withdrawal"
          pendingLabel="Recording…"
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
          variant="danger"
        />
      </form>
    </>
  );
}
