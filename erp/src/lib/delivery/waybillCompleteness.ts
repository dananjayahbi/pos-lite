/**
 * ARGUS #300 - a courier waybill must not look deliverable when the recipient
 * block is missing. Two live deliveries without a shipping address printed
 * To "-", Address "-", Branch "-" and Contact "-".
 *
 * The print path and every print button use these rules; the print functions
 * also throw as a last line of defence.
 */
export interface WaybillRecipientAddress {
  fullName?: string | null | undefined;
  phone?: string | null | undefined;
  phone2?: string | null | undefined;
  addressLine1?: string | null | undefined;
  addressLine2?: string | null | undefined;
  cityName?: string | null | undefined;
  districtName?: string | null | undefined;
  postalCode?: string | null | undefined;
}

export interface WaybillPrintDecision {
  canPrint: boolean;
  /** Human-readable missing field labels, in waybill row order. */
  missing: string[];
  /** Ready-to-show warning, or null when the address is complete. */
  reason: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

export function missingWaybillRecipientFields(
  address: WaybillRecipientAddress | null | undefined,
): string[] {
  if (!address) {
    return ['Recipient name', 'Contact number', 'Address', 'City or district'];
  }

  const missing: string[] = [];
  if (!hasText(address.fullName)) missing.push('Recipient name');
  if (!hasText(address.phone)) missing.push('Contact number');
  if (!hasText(address.addressLine1)) missing.push('Address');
  if (!hasText(address.cityName) && !hasText(address.districtName)) {
    missing.push('City or district');
  }
  return missing;
}

export function waybillRecipientPrintDecision(
  address: WaybillRecipientAddress | null | undefined,
): WaybillPrintDecision {
  const missing = missingWaybillRecipientFields(address);
  if (missing.length === 0) {
    return { canPrint: true, missing, reason: null };
  }
  return {
    canPrint: false,
    missing,
    reason: `Missing recipient details: ${missing.join(', ')}`,
  };
}
