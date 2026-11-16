/**
 * Product barcode helpers.
 *
 * Every variant carries one barcode, generated when the product is created and
 * stored on `ProductVariant.barcode`. Generated values are EAN-13 in the
 * GS1 "restricted circulation" range (prefix 200), so they scan like any retail
 * barcode while never colliding with a manufacturer's real GTIN.
 *
 * Legacy/hand-typed barcodes are left untouched: the sheet renderer falls back
 * to CODE128 for any value that is not a valid EAN-13.
 */

/** GS1 prefix reserved for in-store / internal use. */
export const INTERNAL_EAN13_PREFIX = '200';

/** Length of an EAN-13 barcode (12 data digits + check digit). */
export const EAN13_LENGTH = 13;

/**
 * Mirrors `CreateVariantInputSchema`'s barcode rule. Kept here so server-side
 * generation and client-side validation cannot drift apart.
 */
export const BARCODE_PATTERN = /^[a-zA-Z0-9-]{8,20}$/;

/** Computes the GS1 check digit for the first 12 digits of an EAN-13. */
export function ean13CheckDigit(firstTwelve: string): string {
  let sum = 0;
  for (let i = 0; i < firstTwelve.length; i++) {
    const digit = Number(firstTwelve[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

/** True when `value` is exactly 13 digits with a valid GS1 check digit. */
export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  return ean13CheckDigit(value.slice(0, 12)) === value.slice(12);
}

function randomDigit(): number {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0) % 10;
}

/**
 * Generates an EAN-13 barcode in the internal-use prefix range:
 * `200` + nine random digits + check digit.
 *
 * Uniqueness is enforced by the caller (and by
 * `@@unique([tenantId, barcode])`), because this function is pure.
 */
export function generateBarcode(): string {
  let body = INTERNAL_EAN13_PREFIX;
  while (body.length < EAN13_LENGTH - 1) {
    body += String(randomDigit());
  }
  return body + ean13CheckDigit(body);
}

/**
 * Picks the symbology for a stored barcode value. Generated values are
 * EAN-13; anything else (legacy numeric codes, SKU-style strings) stays
 * CODE128 so it keeps printing instead of throwing at render time.
 */
export function barcodeSymbology(value: string): 'EAN13' | 'CODE128' {
  return isValidEan13(value) ? 'EAN13' : 'CODE128';
}
