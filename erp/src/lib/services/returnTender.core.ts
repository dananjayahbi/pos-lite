import type {
  PaymentLegMethod,
  PaymentMethod,
  ReturnRefundMethod,
} from '@/generated/prisma/client';

/**
 * ARGUS #96 — refund methods must follow the tender that was actually
 * collected on the original sale.
 *
 * A card reversal credits a card/QR acquirer account; refunding a cash sale
 * that way leaves the drawer short and tells the customer money went back to a
 * card that was never used. Cash can only be handed back when cash was taken.
 * Store credit and exchange settle against a balance / replacement cart, so
 * they stay available regardless of the original tender.
 */

export interface SaleTenderSnapshot {
  paymentMethod?: PaymentMethod | null | undefined;
  payments?: ReadonlyArray<{ method: PaymentLegMethod }> | null | undefined;
}

export const REFUND_METHODS: readonly ReturnRefundMethod[] = [
  'CASH',
  'CARD_REVERSAL',
  'STORE_CREDIT',
  'EXCHANGE',
];

/**
 * Tenders collected on the sale. `Payment` legs are authoritative because a
 * split sale has both a cash and a digital leg; the header `paymentMethod` is
 * only a fallback for rows created before payment legs were persisted.
 */
export function collectedTenderMethods(
  sale: SaleTenderSnapshot | null | undefined,
): ReadonlySet<PaymentLegMethod> {
  const legs = sale?.payments ?? [];
  if (legs.length > 0) {
    return new Set(legs.map((leg) => leg.method));
  }

  switch (sale?.paymentMethod) {
    case 'CASH':
      return new Set(['CASH']);
    case 'CARD':
      return new Set(['CARD']);
    case 'LANKAQR':
      return new Set(['LANKAQR']);
    // The split's digital leg method was not persisted on the sale header, so
    // a legacy split sale is treated as cash-or-card to avoid blocking a valid
    // refund. New split sales always carry Payment legs.
    case 'SPLIT':
      return new Set(['CASH', 'CARD']);
    case 'STORE_CREDIT':
      return new Set(['STORE_CREDIT']);
    case 'EXCHANGE_CREDIT':
      return new Set(['EXCHANGE_CREDIT']);
    default:
      return new Set();
  }
}

/** True when `method` can truthfully settle against the original tender. */
export function isTenderCompatibleRefundMethod(
  method: ReturnRefundMethod,
  sale: SaleTenderSnapshot | null | undefined,
): boolean {
  if (method === 'STORE_CREDIT' || method === 'EXCHANGE') return true;

  const tenders = collectedTenderMethods(sale);
  if (method === 'CASH') return tenders.has('CASH');
  if (method === 'CARD_REVERSAL') {
    return tenders.has('CARD') || tenders.has('LANKAQR');
  }
  return false;
}

/**
 * Customer-facing reason a method is unavailable, or `null` when it may be
 * used. Returns are disabled from the original tender alone; the store-credit
 * "needs a customer" rule is enforced separately.
 */
export function refundMethodTenderMismatchReason(
  method: ReturnRefundMethod,
  sale: SaleTenderSnapshot | null | undefined,
): string | null {
  if (isTenderCompatibleRefundMethod(method, sale)) return null;
  if (method === 'CASH') {
    return 'Not available: no cash was collected on the original sale.';
  }
  if (method === 'CARD_REVERSAL') {
    return 'Not available: the original sale was not paid by card or QR.';
  }
  return 'Not available for the original payment method.';
}

/**
 * Initial/fallback selection when the sale's tender rules out the current
 * choice. Cash first (most common), then the original digital tender, then the
 * balance-based methods.
 */
export function defaultRefundMethodForSale(
  sale: SaleTenderSnapshot | null | undefined,
  options: { storeCreditAvailable: boolean },
): ReturnRefundMethod {
  const preferred: readonly ReturnRefundMethod[] = [
    'CASH',
    'CARD_REVERSAL',
    'STORE_CREDIT',
    'EXCHANGE',
  ];

  for (const method of preferred) {
    if (method === 'STORE_CREDIT' && !options.storeCreditAvailable) continue;
    if (isTenderCompatibleRefundMethod(method, sale)) return method;
  }

  return 'EXCHANGE';
}
