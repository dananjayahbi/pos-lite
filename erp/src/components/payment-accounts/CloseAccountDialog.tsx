'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccountSelect } from './AccountSelect';
import { DialogSubmitRow } from './DialogSubmitRow';
import { formatRupee } from '@/lib/format';
import { parseMoney } from './paymentAccountLabels';
import type { ClosePayload, PaymentAccount } from './paymentAccountTypes';

const NOTE_MAX_LENGTH = 300;

interface CloseAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PaymentAccount[];
  /** The account being retired. */
  account: PaymentAccount | null;
  onSubmit: (payload: ClosePayload) => Promise<void>;
}

export function CloseAccountDialog({
  open,
  onOpenChange,
  accounts,
  account,
  onSubmit,
}: CloseAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && account && (
          <CloseForm
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

interface CloseFormProps {
  account: PaymentAccount;
  accounts: PaymentAccount[];
  onSubmit: (payload: ClosePayload) => Promise<void>;
  onCancel: () => void;
}

function CloseForm({ account, accounts, onSubmit, onCancel }: CloseFormProps) {
  const [transferToAccountId, setTransferToAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = parseMoney(account.balance) ?? 0;
  const hasBalance = balance > 0;
  // The API refuses to close an account that still holds money, so the sweep
  // destination is mandatory while a balance remains.
  const canSubmit = (!hasBalance || transferToAccountId !== null) && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        ...(transferToAccountId ? { transferToAccountId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Could not close the account',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Close Account</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          Closing retires the account for future movements. Its ledger history is
          kept for reporting.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-mist bg-linen/40 p-3">
          <p className="font-body text-[11px] uppercase tracking-wide text-mist">Account</p>
          <p className="mt-1 truncate font-display text-sm font-semibold text-espresso">
            {account.name}
          </p>
          <p className="mt-2 font-body text-xs text-sand">
            Remaining balance:{' '}
            <span className="font-mono text-espresso">{formatRupee(account.balance)}</span>
          </p>
        </div>

        {hasBalance ? (
          <div>
            <Label htmlFor="close-transfer-to" className="font-body">
              Transfer remaining balance to
            </Label>
            <p className="mt-1 font-body text-[11px] text-sand">
              The full {formatRupee(account.balance)} will be swept into the account you pick,
              as a closing-transfer ledger entry. The money does not disappear.
            </p>
            <div className="mt-1.5">
              <AccountSelect
                id="close-transfer-to"
                accounts={accounts}
                value={transferToAccountId}
                onValueChange={setTransferToAccountId}
                placeholder="Select the receiving account"
                excludeAccountId={account.id}
                disabled={isSubmitting}
                className="w-full border-mist"
              />
            </div>
            {transferToAccountId === null && (
              <p className="mt-1 font-body text-xs text-[#9B2226]">
                Pick a receiving account — closing is blocked while a balance remains.
              </p>
            )}
          </div>
        ) : (
          <p className="font-body text-sm text-sand">
            This account holds no money, so nothing needs to be swept before it is closed.
          </p>
        )}

        <div>
          <Label htmlFor="close-note" className="font-body">
            Note <span className="font-normal text-mist">(optional)</span>
          </Label>
          <Input
            id="close-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why is this account being closed?"
            maxLength={NOTE_MAX_LENGTH}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
        </div>

        <p className="rounded-lg border border-[#9B2226]/30 bg-[#9B2226]/5 p-2 font-body text-xs text-[#9B2226]">
          Closing <span className="font-semibold">{account.name}</span> is permanent — it can no
          longer receive deposits, transfers or sales payments.
        </p>

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel={hasBalance ? 'Sweep balance & close' : 'Close account'}
          pendingLabel="Closing…"
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
          variant="danger"
        />
      </form>
    </>
  );
}
