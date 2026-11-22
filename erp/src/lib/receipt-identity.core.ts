/**
 * Receipt identity notice (ARGUS #472).
 *
 * SaleLine snapshots the product name/variant/price/tax amount and Sale
 * snapshots its totals, but the store identity printed on a receipt (name,
 * address, phone, logo, footer) is read from the current Tenant row. The schema
 * has no place to snapshot it, so a reprint can show today's profile.
 *
 * Rather than silently pretending the reprint is the original, the reprint path
 * adds an explicit caveat. Kept pure so both the thermal and return receipt
 * renderers phrase it identically.
 */

export const REPRINT_IDENTITY_NOTICE =
  'Reprint - store details reflect the current profile, not the values at the time of sale.';

/**
 * The receipt UI asks for a reprint with `?reprint=1`. Only the explicit
 * truthy forms mark a document as a reprint; an unknown value is ignored.
 */
export function isReprintRequest(value: string | null | undefined): boolean {
  return value === '1' || value === 'true';
}

/** Notice text for a reprint, or null for an original print. */
export function reprintIdentityNotice(isReprint: boolean | null | undefined): string | null {
  return isReprint === true ? REPRINT_IDENTITY_NOTICE : null;
}
