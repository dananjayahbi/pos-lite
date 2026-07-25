'use client';

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type MovementType = 'PETTY_CASH_OUT' | 'MANUAL_IN';

interface RecordCashMovementFormProps {
  onSubmit: (data: { type: MovementType; amount: number; reason: string }) => Promise<void>;
}

export default function RecordCashMovementForm({ onSubmit }: RecordCashMovementFormProps) {
  const [type, setType] = useState<MovementType>('PETTY_CASH_OUT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setSubmitting(true);
    try {
      await onSubmit({ type, amount: parsedAmount, reason: reason.trim() });
      setType('PETTY_CASH_OUT');
      setAmount('');
      setReason('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <div className="space-y-2">
        <Label className="text-espresso font-body">Type</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setType('PETTY_CASH_OUT')}
            className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-body transition-colors ${
              type === 'PETTY_CASH_OUT'
                ? 'border-terracotta bg-sand text-espresso'
                : 'border-mist bg-white text-espresso/60 hover:border-espresso/30'
            }`}
          >
            Petty Cash Out
          </button>
          <button
            type="button"
            onClick={() => setType('MANUAL_IN')}
            className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-body transition-colors ${
              type === 'MANUAL_IN'
                ? 'border-terracotta bg-sand text-espresso'
                : 'border-mist bg-white text-espresso/60 hover:border-espresso/30'
            }`}
          >
            Cash Deposited
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="cm-amount" className="text-espresso font-body">
          Amount
        </Label>
        <Input
          ref={amountRef as React.RefObject<HTMLInputElement>}
          id="cm-amount"
          type="number"
          step="0.01"
          min="0.01"
          max="9999.99"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-mono border-mist"
          required
        />
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cm-reason" className="text-espresso font-body">
            Reason
          </Label>
          <span className="text-xs text-espresso/50 font-body">
            {reason.length}/200
          </span>
        </div>
        <Textarea
          id="cm-reason"
          value={reason}
          onChange={(e) => {
            if (e.target.value.length <= 200) {
              setReason(e.target.value);
            }
          }}
          placeholder="e.g. Purchased cleaning supplies"
          maxLength={200}
          className="resize-none border-mist"
          rows={3}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={submitting || !amount || parseFloat(amount) <= 0}
        className="w-full bg-terracotta hover:bg-terracotta/90 text-white"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Recording…
          </>
        ) : (
          'Record Movement'
        )}
      </Button>
    </form>
  );
}
