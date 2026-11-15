/**
 * Pure formatting helpers for the courier "Proof of Delivery" waybill.
 *
 * Kept out of the React component so the print layout rules (date format,
 * money format, description fallbacks, barcode source) are unit-testable.
 */

/** Reference date format: DD/MM/YYYY. */
export function formatWaybillDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** The courier's sheet prints money without a currency prefix: 3,300.00. */
export function formatWaybillAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface WaybillDescriptionInput {
  itemCount: number | null | undefined;
  totalWeightKg: string | number | null | undefined;
  showItemCount: boolean;
  showWeight: boolean;
  fallback?: string | null;
}

/** "2 items · 1.5 kg" — the Order Description row. */
export function buildWaybillDescription({
  itemCount,
  totalWeightKg,
  showItemCount,
  showWeight,
  fallback,
}: WaybillDescriptionInput): string {
  const count = itemCount ?? 1;
  const parts: string[] = [];
  if (showItemCount) parts.push(`${count} item${count === 1 ? '' : 's'}`);
  if (showWeight && totalWeightKg !== null && totalWeightKg !== undefined && `${totalWeightKg}` !== '') {
    parts.push(`${totalWeightKg} kg`);
  }
  const description = parts.join(' · ');
  if (description) return description;
  return fallback ?? '—';
}

/**
 * The header barcode shows the courier waybill when present; otherwise it
 * falls back to the order reference only when order refs are enabled.
 */
export function waybillBarcodeValue({
  waybillId,
  orderRef,
  showOrderRef,
}: {
  waybillId: string | null | undefined;
  orderRef: string | null | undefined;
  showOrderRef: boolean;
}): string | null {
  if (waybillId) return waybillId;
  if (showOrderRef && orderRef) return orderRef;
  return null;
}
