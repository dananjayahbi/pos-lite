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
  LANKAQR: 'LankaQR',
  SPLIT: 'Split',
  STORE_CREDIT: 'Store Credit',
  EXCHANGE_CREDIT: 'Exchange Credit',
  NONE: 'None',
};

/** Human label for a payment method; unknown values stay readable. */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '-';
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}
