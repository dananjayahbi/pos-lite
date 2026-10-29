'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ACCOUNT_TYPE_LABELS } from './paymentAccountLabels';
import { PAYMENT_ACCOUNT_TYPES } from './paymentAccountTypes';
import type {
  AccountDetailRow,
  CreateAccountPayload,
  PaymentAccount,
  PaymentAccountType,
  UpdateAccountPayload,
} from './paymentAccountTypes';
import { DialogSubmitRow } from './DialogSubmitRow';

/** Mirrors `CreatePaymentAccountSchema` / `UpdatePaymentAccountSchema`. */
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const ACCOUNT_NUMBER_MAX_LENGTH = 60;
const NOTE_MAX_LENGTH = 500;
const DETAILS_MAX_ROWS = 20;
const DETAIL_LABEL_MAX_LENGTH = 60;
const DETAIL_VALUE_MAX_LENGTH = 200;

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode; absent = create. */
  account?: PaymentAccount | undefined;
  onCreate: (payload: CreateAccountPayload) => Promise<void>;
  onUpdate: (payload: UpdateAccountPayload) => Promise<void>;
}

export function CreateAccountDialog({
  open,
  onOpenChange,
  account,
  onCreate,
  onUpdate,
}: CreateAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Keyed on `open` so every open remounts the form with state seeded
            from the account being edited — no reset effect needed. */}
        {open && (
          <AccountForm
            {...(account ? { account } : {})}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DetailsEditorProps {
  rows: AccountDetailRow[];
  onChange: (rows: AccountDetailRow[]) => void;
  disabled: boolean;
}

function DetailsEditor({ rows, onChange, disabled }: DetailsEditorProps) {
  const update = (index: number, patch: Partial<AccountDetailRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="rounded-lg border border-mist bg-linen/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="font-body text-espresso">Account details</Label>
        <span className="font-body text-[11px] text-mist">
          {rows.length}/{DETAILS_MAX_ROWS}
        </span>
      </div>
      <p className="mt-1 font-body text-[11px] text-sand">
        Branch, SWIFT code, merchant id — whatever helps identify this account.
      </p>

      <div className="mt-2 space-y-2">
        {rows.length === 0 && (
          <p className="font-body text-xs text-mist">No details added yet.</p>
        )}
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={row.label}
              onChange={(event) => update(index, { label: event.target.value })}
              placeholder="Label"
              maxLength={DETAIL_LABEL_MAX_LENGTH}
              className="border-mist bg-pearl"
              disabled={disabled}
              aria-label={`Detail ${index + 1} label`}
            />
            <Input
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
              placeholder="Value"
              maxLength={DETAIL_VALUE_MAX_LENGTH}
              className="border-mist bg-pearl"
              disabled={disabled}
              aria-label={`Detail ${index + 1} value`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              disabled={disabled}
              className="text-sand hover:text-[#9B2226]"
              aria-label={`Remove detail ${index + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { label: '', value: '' }])}
        disabled={disabled || rows.length >= DETAILS_MAX_ROWS}
        className="mt-2 border-mist font-body text-espresso"
      >
        <Plus className="h-3.5 w-3.5" />
        Add row
      </Button>
    </div>
  );
}

interface AccountFormProps {
  account?: PaymentAccount;
  onCreate: (payload: CreateAccountPayload) => Promise<void>;
  onUpdate: (payload: UpdateAccountPayload) => Promise<void>;
  onCancel: () => void;
}

function AccountForm({ account, onCreate, onUpdate, onCancel }: AccountFormProps) {
  const isEditing = account !== undefined;

  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<PaymentAccountType>(account?.type ?? 'CASH');
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [note, setNote] = useState(account?.note ?? '');
  const [details, setDetails] = useState<AccountDetailRow[]>(account?.details ?? []);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedName = name.trim();
  const nameValid =
    trimmedName.length >= NAME_MIN_LENGTH && trimmedName.length <= NAME_MAX_LENGTH;
  const openingBalanceNumber = Number.parseFloat(openingBalance);
  const openingBalanceValid =
    isEditing ||
    openingBalance.trim() === '' ||
    (!Number.isNaN(openingBalanceNumber) && openingBalanceNumber >= 0);
  const canSubmit = nameValid && openingBalanceValid && !isSubmitting;

  /** Blank rows would only add noise to the stored JSON. */
  const cleanedDetails = details
    .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
    .filter((row) => row.label.length > 0 || row.value.length > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError('');

    try {
      if (isEditing) {
        await onUpdate({
          name: trimmedName,
          type,
          accountNumber: accountNumber.trim() === '' ? null : accountNumber.trim(),
          note: note.trim() === '' ? null : note.trim(),
          details: cleanedDetails,
        });
      } else {
        await onCreate({
          name: trimmedName,
          type,
          ...(accountNumber.trim() ? { accountNumber: accountNumber.trim() } : {}),
          ...(openingBalance.trim() !== '' && openingBalanceNumber > 0
            ? { openingBalance: openingBalanceNumber }
            : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(cleanedDetails.length > 0 ? { details: cleanedDetails } : {}),
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">
          {isEditing ? 'Edit Account' : 'Add Payment Account'}
        </DialogTitle>
        <DialogDescription className="font-body text-sm text-mist">
          {isEditing
            ? 'Update how this account is identified. Balances only change through ledger movements.'
            : 'Money movements are recorded against payment accounts, so this is where cash, bank and gateway balances live.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="payment-account-name" className="font-body">
            Name
          </Label>
          <Input
            id="payment-account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Commercial Bank — Main"
            maxLength={NAME_MAX_LENGTH}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
            autoFocus
          />
          <p className="mt-1 text-right font-body text-[11px] text-mist">
            {name.length}/{NAME_MAX_LENGTH}
          </p>
        </div>

        <div>
          <Label htmlFor="payment-account-type" className="font-body">
            Type
          </Label>
          <Select
            value={type}
            onValueChange={(next) => setType(next as PaymentAccountType)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="payment-account-type" className="mt-1.5 w-full border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_ACCOUNT_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {ACCOUNT_TYPE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="payment-account-number" className="font-body">
            Account number <span className="font-normal text-mist">(optional)</span>
          </Label>
          <Input
            id="payment-account-number"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            placeholder="Bank account no. / merchant id"
            maxLength={ACCOUNT_NUMBER_MAX_LENGTH}
            className="mt-1.5 border-mist font-mono"
            disabled={isSubmitting}
          />
        </div>

        {!isEditing && (
          <div>
            <Label htmlFor="payment-account-opening" className="font-body">
              Opening balance
            </Label>
            <Input
              id="payment-account-opening"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
              className="mt-1.5 border-mist font-mono"
              disabled={isSubmitting}
            />
            <p className="mt-1 font-body text-[11px] text-sand">
              Posted as an opening-balance ledger entry so the book always reconciles.
            </p>
            {!openingBalanceValid && (
              <p className="mt-1 font-body text-xs text-[#9B2226]">
                Opening balance cannot be negative.
              </p>
            )}
          </div>
        )}

        <DetailsEditor rows={details} onChange={setDetails} disabled={isSubmitting} />

        <div>
          <Label htmlFor="payment-account-note" className="font-body">
            Note <span className="font-normal text-mist">(optional)</span>
          </Label>
          <Input
            id="payment-account-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything worth remembering about this account"
            maxLength={NOTE_MAX_LENGTH}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
        </div>

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <DialogSubmitRow
          submitLabel={isEditing ? 'Save changes' : 'Create account'}
          pendingLabel={isEditing ? 'Saving…' : 'Creating…'}
          isPending={isSubmitting}
          disabled={!canSubmit}
          onCancel={onCancel}
        />
      </form>
    </>
  );
}
