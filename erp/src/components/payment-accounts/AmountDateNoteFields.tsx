'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AmountDateNoteFieldsProps {
  amount: string;
  onAmountChange: (value: string) => void;
  entryDate: string;
  onEntryDateChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  amountError?: string | undefined;
  /** Rendered under the amount field while the entry is still valid. */
  amountHint?: string | undefined;
  disabled?: boolean;
  idPrefix: string;
}

const NOTE_MAX_LENGTH = 300;

/**
 * The three inputs every money-movement dialog repeats: amount, date, note.
 * Keeping them in one place means labels, limits and error styling cannot drift
 * between deposit, withdrawal and transfer.
 */
export function AmountDateNoteFields({
  amount,
  onAmountChange,
  entryDate,
  onEntryDateChange,
  note,
  onNoteChange,
  amountError,
  amountHint,
  disabled,
  idPrefix,
}: AmountDateNoteFieldsProps) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-amount`} className="font-body">
          Amount
        </Label>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0.00"
          className="mt-1.5 border-mist font-mono"
          disabled={disabled}
        />
        {amountError ? (
          <p className="mt-1 font-body text-xs text-[#9B2226]">{amountError}</p>
        ) : (
          amountHint !== undefined && (
            <p className="mt-1 font-body text-xs text-sand">{amountHint}</p>
          )
        )}
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-date`} className="font-body">
          Date
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={entryDate}
          onChange={(event) => onEntryDateChange(event.target.value)}
          className="mt-1.5 border-mist"
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-note`} className="font-body">
          Note <span className="font-normal text-mist">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}-note`}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="What is this movement for?"
          maxLength={NOTE_MAX_LENGTH}
          className="mt-1.5 border-mist"
          disabled={disabled}
        />
      </div>
    </>
  );
}
