/**
 * One payment-method vocabulary for the sales surfaces (ARGUS #89).
 *
 * The filter offered no NONE option while zero-value sales displayed a plain
 * "NONE" badge, and the detail modal printed enum values directly. Both now use
 * this label map, so the filter, list badge and modal agree.
 */

export const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  CASH: 'Cash',
  CARD: 'Card',
  CARD_REVERSAL: 'Card Reversal',
  LANKAQR: 'LankaQR',
  SPLIT: 'Split',
  STORE_CREDIT: 'Store Credit',
  EXCHANGE_CREDIT: 'Exchange Credit',
  EXCHANGE: 'Exchange',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  NONE: 'None',
};

/**
 * Human label for a payment method; unknown values stay readable.
 *
 * The fallback title-cases the enum (`BANK_TRANSFER` → `Bank Transfer`) instead
 * of printing it raw, which is what the cash-flow method line used to do for
 * LANKAQR and card reversals (ARGUS #423).
 */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '-';
  return (
    PAYMENT_METHOD_LABELS[method] ??
    method
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}
