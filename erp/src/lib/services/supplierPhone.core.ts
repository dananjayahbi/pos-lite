/**
 * Canonical uniqueness key for supplier phone numbers (ARGUS #236).
 *
 * The supplier contract stores the operator's format verbatim (`+94XXXXXXXXX`
 * or `07XXXXXXXX`) because Module 06 pins that display behaviour. Uniqueness,
 * however, must not depend on the format: the same number typed both ways used
 * to create two suppliers because `@@unique([tenantId, phone])` compares the raw
 * strings.
 *
 * `supplierPhoneKey` maps both forms to `94XXXXXXXXX` for comparison only; the
 * stored `phone` column is never rewritten. This mirrors the customer
 * normaliser (`normalizeSriLankaPhone` → `+94...`) with the leading `+` removed.
 */

export interface SupplierPhoneRow {
  id: string;
  phone: string;
  isActive: boolean;
}

/** `+94 77 123 4567` and `077-123-4567` both become `94771234567`. */
export function supplierPhoneKey(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+94')) return digits.slice(1);
  if (digits.startsWith('94')) return digits;
  if (digits.startsWith('0')) return `94${digits.slice(1)}`;
  return digits;
}

/**
 * Find a tenant supplier that already reserves the candidate number, in any
 * accepted format. Archived rows reserve their phone too (same policy as the
 * original exact-match check), and `excludeSupplierId` keeps an update from
 * matching itself.
 */
export function findSupplierPhoneClash(
  candidatePhone: string,
  rows: ReadonlyArray<SupplierPhoneRow>,
  excludeSupplierId?: string | null,
): SupplierPhoneRow | null {
  const key = supplierPhoneKey(candidatePhone);
  for (const row of rows) {
    if (excludeSupplierId && row.id === excludeSupplierId) continue;
    if (supplierPhoneKey(row.phone) === key) return row;
  }
  return null;
}
