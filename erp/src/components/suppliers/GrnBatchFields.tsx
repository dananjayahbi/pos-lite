'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * M16-02 (BUG-49) — per-line batch number / expiry date capture for the GRN
 * receiving worksheet.
 *
 * The receive API already accepts and persists both fields (`ReceivePOLineSchema`
 * → `receivePOLines` accumulates a `BatchTracking` row and links the
 * `PURCHASE_RECEIVED` movement to it) — only the worksheet was missing the
 * inputs, so warehouse users could not supply them.
 *
 * Field contract:
 *  - `batchNumber` is trimmed and capped at 100 chars client-side; it is sent
 *    as `undefined` when blank so a non-batch line behaves exactly as before.
 *  - `expiryDate` uses a native `<input type="date">` (local `YYYY-MM-DD`), and
 *    is only forwarded when the user picked a date — the worksheet converts it
 *    to a full ISO timestamp because the API requires `z.string().datetime()`.
 *
 * No product/variant flag marks a line as batch-tracked (see `prisma/schema.prisma`:
 * neither `Product` nor `ProductVariant` carries a batch-required column, and
 * `BatchTracking` rows are created on demand), so the fields are always shown
 * with a helper note instead of being hidden behind a flag that does not exist.
 */

/** Client-side ceiling on `batchNumber` (the DB column is unbounded). */
export const MAX_BATCH_NUMBER_LENGTH = 100;

export interface GrnBatchFieldsProps {
  /** Current receiving row index/id, used to derive unique input ids. */
  lineId: string;
  batchNumber: string;
  expiryDate: string;
  disabled?: boolean;
  onBatchNumberChange: (value: string) => void;
  onExpiryDateChange: (value: string) => void;
}

export function GrnBatchFields({
  lineId,
  batchNumber,
  expiryDate,
  disabled = false,
  onBatchNumberChange,
  onExpiryDateChange,
}: GrnBatchFieldsProps) {
  const batchInputId = `grn-batch-${lineId}`;
  const expiryInputId = `grn-expiry-${lineId}`;

  return (
    <div className="space-y-1.5 min-w-52">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={batchInputId} className="text-[11px] font-body text-mist">
            Batch no.
          </Label>
          <Input
            id={batchInputId}
            type="text"
            className="h-8 font-mono text-xs"
            maxLength={MAX_BATCH_NUMBER_LENGTH}
            placeholder="Optional"
            value={batchNumber}
            disabled={disabled}
            onChange={(event) => onBatchNumberChange(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={expiryInputId} className="text-[11px] font-body text-mist">
            Expiry
          </Label>
          <Input
            id={expiryInputId}
            type="date"
            className="h-8 text-xs"
            value={expiryDate}
            disabled={disabled}
            onChange={(event) => onExpiryDateChange(event.target.value)}
          />
        </div>
      </div>
      <p className="text-[10px] leading-tight text-mist">
        Leave blank for goods without batch tracking.
      </p>
    </div>
  );
}