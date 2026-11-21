/**
 * Pure formatting helpers for the courier "Proof of Delivery" waybill.
 *
 * Kept out of the React component so the print layout rules (date format,
 * money format, description fallbacks, barcode source) are unit-testable.
 */

/** Reference date format: DD/MM/YYYY. */
export function formatWaybillDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** The courier's sheet prints money without a currency prefix: 3,300.00. */
export function formatWaybillAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function trimmed(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * ARGUS #302: city and district are frequently the same locality ("Colombo,
 * Colombo", "Deiyandara, Deiyandara"). Print one occurrence instead of the
 * repeated text, matching the Branch row's existing de-duplication.
 */
export function dedupeLocality(
  city?: string | null,
  district?: string | null,
  separator = ', ',
): string {
  const cityText = trimmed(city);
  const districtText = trimmed(district);
  if (!cityText) return districtText;
  if (!districtText) return cityText;
  return cityText.toLowerCase() === districtText.toLowerCase()
    ? cityText
    : `${cityText}${separator}${districtText}`;
}

export interface WaybillAddressInput {
  addressLine1?: string | null | undefined;
  addressLine2?: string | null | undefined;
  cityName?: string | null | undefined;
  districtName?: string | null | undefined;
  postalCode?: string | null | undefined;
}

/**
 * Join the recipient address with a single city/district occurrence. Adjacent
 * identical parts are also collapsed, so an address line that already repeats
 * the city never prints it twice.
 */
export function buildWaybillAddress(address: WaybillAddressInput): string {
  const parts = [
    trimmed(address.addressLine1),
    trimmed(address.addressLine2),
    dedupeLocality(address.cityName, address.districtName),
    trimmed(address.postalCode),
  ].filter(Boolean);

  const deduped: string[] = [];
  for (const part of parts) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.toLowerCase() === part.toLowerCase()) continue;
    deduped.push(part);
  }
  return deduped.join(', ');
}

export interface WaybillDescriptionInput {
  itemCount: number | null | undefined;
  totalWeightKg: string | number | null | undefined;
  showItemCount: boolean;
  showWeight: boolean;
  fallback?: string | null;
}

/**
 * ARGUS #303: the same field printed as absent, `1 kg` and `1.5 kg`. The
 * courier sheet uses one two-decimal form; a missing weight is explicit.
 */
export function formatWaybillWeight(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || `${value}`.trim() === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

/** "2 items · 1.50 kg" — the Order Description row. */
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
  if (showWeight) {
    const weight = formatWaybillWeight(totalWeightKg);
    parts.push(weight ? `${weight} kg` : 'weight n/a');
  }
  const description = parts.join(' · ');
  if (description) return description;
  return fallback ?? '-';
}

/**
 * The header barcode is the courier waybill only. A pre-dispatch delivery has
 * no courier-issued code, so printing the internal order reference in the
 * barcode position made an unofficial label look like a courier POD (ARGUS
 * #299). Such labels must be rendered as an explicit draft instead.
 */
export function waybillBarcodeValue({
  waybillId,
}: {
  waybillId?: string | null | undefined;
  orderRef?: string | null | undefined;
  showOrderRef?: boolean | undefined;
}): string | null {
  return waybillId || null;
}

/** True when there is no courier waybill yet, so the label is a draft. */
export function isDraftWaybill(waybillId: string | null | undefined): boolean {
  return !waybillId;
}
