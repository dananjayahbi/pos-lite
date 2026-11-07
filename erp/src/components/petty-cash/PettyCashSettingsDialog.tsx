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
import { DialogSubmitRow } from '@/components/payment-accounts/DialogSubmitRow';
import { parseMoney } from '@/components/payment-accounts/paymentAccountLabels';

export interface PettyCashSettingsPayload {
  name: string;
  lowBalanceThreshold: number | null;
}

interface PettyCashSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  lowBalanceThreshold: string | null;
  onSubmit: (payload: PettyCashSettingsPayload) => Promise<void>;
}

/**
 * Owner-only fund settings. Opening balance is intentionally absent: money is
 * added with Add Cash In (which posts a ledger entry) rather than by rewriting
 * the allocation.
 */
export function PettyCashSettingsDialog({
  open,
  onOpenChange,
  name,
  lowBalanceThreshold,
  onSubmit,
}: PettyCashSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <SettingsForm
            initialName={name}
            initialThreshold={lowBalanceThreshold}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SettingsFormProps {
  initialName: string;
  initialThreshold: string | null;
  onSubmit: (payload: PettyCashSettingsPayload) => Promise<void>;
  onCancel: () => void;
}

function SettingsForm({
  initialName,
  initialThreshold,
  onSubmit,
  onCancel,
}: SettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [threshold, setThreshold] = useState(initialThreshold ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= 80;
  const thresholdValue = threshold.trim() === '' ? null : parseMoney(threshold);
  const thresholdValid = threshold.trim() === '' || (thresholdValue !== null && thresholdValue >= 0);
  const canSubmit = nameValid && thresholdValid && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        name: trimmedName,
        lowBalanceThreshold: thresholdValue,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Settings update failed');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Fund Settings</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist-ink">
          Owner-only settings for the petty cash fund. The linked payment account name is
          kept in sync.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="petty-cash-fund-name" className="font-body">
            Fund Name
          </Label>
          <Input
            id="petty-cash-fund-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Main Petty Cash"
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
          {!nameValid && (
            <p className="mt-1 font-body text-xs text-[#9B2226]">
              Fund name is required (maximum 80 characters).
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="petty-cash-threshold" className="font-body">
            Low-Balance Threshold (LKR){' '}
            <span className="font-normal text-mist-ink">(optional)</span>
          </Label>
          <Input
            id="petty-cash-threshold"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="Optional"
            className="mt-1.5 border-mist font-mono"
            disabled={isSubmitting}
          />
          {!thresholdValid && (
            <p className="mt-1 font-body text-xs text-[#9B2226]">
              Threshold must be zero or greater.
            </p>
          )}
          <p className="mt-1 font-body text-xs text-sand-ink">
            A low-balance notification is sent when the current balance drops to or below
            this value. Leave empty to disable the alert.
          </p>
        </div>

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel="Save settings"
          pendingLabel="Saving…"
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
        />
      </form>
    </>
  );
}
