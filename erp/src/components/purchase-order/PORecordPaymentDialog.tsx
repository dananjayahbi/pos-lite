'use client';

import { useState } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupee } from '@/lib/format';

import { pinDayToNoonIso, todayIso } from './poDates';
import { POPaymentAccountField } from './POPaymentAccountField';
import type { RecordPaymentPayload } from './poTypes';

/**
 * Record a payment against a purchase order.
 *
 * The amount is capped at the outstanding balance client-side (the API also
 * enforces it) and the date is pinned to local noon so a backdated payment can
 * never land on the previous day in UTC.
 */
interface PORecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceNo: string;
  outstanding: number;
  /** Account pre-selected on the PO, when one was chosen up front. */
  defaultAccountId: string | null;
  onSubmit: (payload: RecordPaymentPayload) => Promise<void>;
}

export function PORecordPaymentDialog({
  open,
  onOpenChange,
  referenceNo,
  outstanding,
  defaultAccountId,
  onSubmit,
}: PORecordPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keying on `open` remounts the form so its state is fresh each time
            without a resetting effect. */}
        {open && (
          <RecordPaymentForm
            referenceNo={referenceNo}
            outstanding={outstanding}
            defaultAccountId={defaultAccountId}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RecordPaymentFormProps {
  referenceNo: string;
  outstanding: number;
  defaultAccountId: string | null;
  onSubmit: (payload: RecordPaymentPayload) => Promise<void>;
  onCancel: () => void;
}

function RecordPaymentForm({
  referenceNo,
  outstanding,
  defaultAccountId,
  onSubmit,
  onCancel,
}: RecordPaymentFormProps) {
  const [accountId, setAccountId] = useState<string | null>(defaultAccountId);
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding.toFixed(2) : '');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountNumber = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const exceedsOutstanding = amountValid && amountNumber > outstanding + 0.005;

  const canSubmit =
    accountId !== null && amountValid && !exceedsOutstanding && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || accountId === null) return;

    setIsSubmitting(true);
    setError('');
    try {
      const paidAtIso = pinDayToNoonIso(paidAt);
      await onSubmit({
        paymentAccountId: accountId,
        amount: Math.round(amountNumber * 100) / 100,
        ...(paidAtIso !== undefined ? { paidAt: paidAtIso } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Payment failed');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Record Payment</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          Settle {referenceNo} from a payment account. Outstanding:{' '}
          <span className="font-mono text-espresso">{formatRupee(outstanding)}</span>
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <POPaymentAccountField
          value={accountId}
          onChange={setAccountId}
          disabled={isSubmitting}
        />

        <div>
          <Label htmlFor="po-payment-amount" className="font-body">
            Amount
          </Label>
          <Input
            id="po-payment-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={outstanding}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="mt-1.5 border-mist font-mono"
            disabled={isSubmitting}
          />
          {exceedsOutstanding ? (
            <p className="mt-1 font-body text-xs text-red-600">
              Only {formatRupee(outstanding)} is outstanding.
            </p>
          ) : (
            <p className="mt-1 font-body text-xs text-mist">
              Up to {formatRupee(outstanding)} can be paid.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="po-payment-date" className="font-body">
            Paid on
          </Label>
          <Input
            id="po-payment-date"
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="po-payment-reference" className="font-body">
            Reference <span className="font-normal text-mist">(optional)</span>
          </Label>
          <Input
            id="po-payment-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Cheque / transfer reference"
            maxLength={80}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="po-payment-note" className="font-body">
            Note <span className="font-normal text-mist">(optional)</span>
          </Label>
          <Input
            id="po-payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What is this payment for?"
            maxLength={300}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
        </div>

        {error ? <p className="font-body text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : (
              'Record payment'
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-sand hover:text-espresso"
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
