/**
 * Receipt identity resolution (ARGUS #473, #491, #492).
 *
 * Every receipt surface (browser 80 mm thermal, ESC/POS printer, A4 return
 * receipt) must print the *same* store identity: the tenant's own name, contact
 * details and footer. Historically the paths disagreed and a QA suite left a
 * hardcoded footer from a different business in the live tenant, so a customer
 * receipt could carry another brand and no contact details.
 *
 * This module is the single source of truth for:
 *   - the footer fallback (one string, never a per-surface variant),
 *   - contact lines (address/phone, preserving the operator's line breaks),
 *   - a settings-page audit that flags a footer naming a *different* business.
 *
 * Pure so the renderers, the settings page and the tests cannot drift.
 */

export const DEFAULT_RECEIPT_FOOTER = 'Thank you for shopping with us!';

export interface ReceiptProfileInput {
  storeName: string;
  address: string;
  phoneNumber: string;
  receiptFooter: string;
  email?: string;
}

export type ReceiptIdentityIssueCode =
  | 'footer-missing'
  | 'footer-other-brand'
  | 'address-missing'
  | 'phone-missing';

export interface ReceiptIdentityIssue {
  code: ReceiptIdentityIssueCode;
  message: string;
}

/** Split operator-entered text into printed lines (CRLF, LF and CR). */
export function splitReceiptLines(value: string | null | undefined): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The footer that actually prints: the saved text, or one shared fallback. */
export function resolveReceiptFooter(value: string | null | undefined): string {
  const lines = splitReceiptLines(value);
  return lines.length > 0 ? lines.join('\n') : DEFAULT_RECEIPT_FOOTER;
}

/**
 * Extract a business name from the common "Thank you for shopping at X!"
 * footer shape. Returns null for arbitrary copy (no false positives).
 */
export function brandNamedInFooter(footer: string): string | null {
  const match = footer.match(/thank you for shopping (?:at|with)\s+(.+?)[!.\n]*$/i);
  if (!match) return null;
  const brand = match[1]?.trim();
  if (!brand) return null;
  // "shopping with us" is a generic phrase, not a brand.
  if (/^(us|you)$/i.test(brand)) return null;
  return brand;
}

function normaliseBrand(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * True when the footer names a different business than the tenant. This is the
 * defect ARGUS #473 saw: "Thank you for shopping at Ayur Wellness Centre!" on
 * a Ruhunu Weda Gedara receipt after the 07 suite restored a hardcoded brand.
 */
export function receiptFooterNamesOtherBrand(
  storeName: string,
  receiptFooter: string,
): boolean {
  const named = brandNamedInFooter(resolveReceiptFooter(receiptFooter));
  if (!named) return false;
  const store = normaliseBrand(storeName);
  if (!store) return false;
  return normaliseBrand(named) !== store;
}

/**
 * Settings-page audit. The receipt still prints whatever is saved; these issues
 * tell the operator exactly what is missing or contradictory before a customer
 * sees it.
 */
export function receiptIdentityIssues(input: ReceiptProfileInput): ReceiptIdentityIssue[] {
  const issues: ReceiptIdentityIssue[] = [];
  const footer = resolveReceiptFooter(input.receiptFooter);

  if (splitReceiptLines(input.receiptFooter).length === 0) {
    issues.push({
      code: 'footer-missing',
      message: `No receipt footer saved. Receipts print "${DEFAULT_RECEIPT_FOOTER}".`,
    });
  } else if (receiptFooterNamesOtherBrand(input.storeName, footer)) {
    const named = brandNamedInFooter(footer);
    issues.push({
      code: 'footer-other-brand',
      message: `The receipt footer names "${named}", not "${input.storeName}". Customers will see another business on their receipt.`,
    });
  }

  if (splitReceiptLines(input.address).length === 0) {
    issues.push({
      code: 'address-missing',
      message: 'No store address saved, so receipts print without an address.',
    });
  }

  if (splitReceiptLines(input.phoneNumber).length === 0) {
    issues.push({
      code: 'phone-missing',
      message: 'No phone number saved, so receipts print without a contact number.',
    });
  }

  return issues;
}

/** Contact lines as they appear on every receipt path. */
export function receiptContactLines(input: {
  address?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}): string[] {
  const lines = splitReceiptLines(input.address);
  const phone = splitReceiptLines(input.phoneNumber).join(' ');
  if (phone) lines.push(`Tel: ${phone}`);
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (email) lines.push(email);
  return lines;
}

/** Customer-facing footer lines for any receipt surface. */
export function receiptFooterLines(receiptFooter: string | null | undefined): string[] {
  return splitReceiptLines(resolveReceiptFooter(receiptFooter));
}
