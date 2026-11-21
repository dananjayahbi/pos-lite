import Decimal from 'decimal.js';

import type { PaymentLegMethod, PaymentMethod } from '@/generated/prisma/client';

export interface SaleTenderLeg {
  method: PaymentLegMethod;
  amount: Decimal;
}

/**
 * Split a sale's settlement into persisted payment legs.
 *
 * Store credit is a tender (ARGUS #61). It settles the part of the sale the
 * customer's balance covers, and the selected cash/card/QR tender settles only
 * the remaining payable. The legs always sum to the sale total, so
 * `sum(payments) === Sale.totalAmount` holds and the shift drawer reconciles
 * against money that actually moved.
 *
 * Callers are responsible for validating the inputs (credit ≤ total, card
 * portion ≤ payable); this function only places the amounts.
 */
export function buildSaleTenderLegs(input: {
  paymentMethod: PaymentMethod;
  /** Amount still to collect after store credit and exchange credit. */
  payableAmount: Decimal;
  creditAmount: Decimal;
  /** Credit from the linked EXCHANGE return applied to this sale. */
  exchangeCreditAmount?: Decimal | undefined;
  cardAmount?: Decimal | undefined;
  splitLegMethod?: 'CARD' | 'LANKAQR' | undefined;
}): SaleTenderLeg[] {
  const legs: SaleTenderLeg[] = [];
  const payable = input.payableAmount;
  const exchangeCredit = input.exchangeCreditAmount ?? new Decimal(0);

  if (payable.greaterThan(0)) {
    switch (input.paymentMethod) {
      case 'CASH':
        legs.push({ method: 'CASH', amount: payable });
        break;
      case 'CARD':
        legs.push({ method: 'CARD', amount: payable });
        break;
      case 'LANKAQR':
        legs.push({ method: 'LANKAQR', amount: payable });
        break;
      case 'SPLIT': {
        const digital = input.cardAmount ?? new Decimal(0);
        if (digital.greaterThan(0)) {
          legs.push({ method: input.splitLegMethod ?? 'CARD', amount: digital });
        }
        const cash = payable.minus(digital);
        if (cash.greaterThan(0)) {
          legs.push({ method: 'CASH', amount: cash });
        }
        break;
      }
      case 'NONE':
      case 'STORE_CREDIT':
      case 'EXCHANGE_CREDIT':
        // Not a collectable tender: any payable amount must use cash/card/QR.
        break;
    }
  }

  if (input.creditAmount.greaterThan(0)) {
    legs.push({ method: 'STORE_CREDIT', amount: input.creditAmount });
  }

  if (exchangeCredit.greaterThan(0)) {
    legs.push({ method: 'EXCHANGE_CREDIT', amount: exchangeCredit });
  }

  return legs;
}

/**
 * Credit redeemed by a sale, split by tender (ARGUS void-refund fix).
 *
 * A void must return both STORE_CREDIT and EXCHANGE_CREDIT back to the customer;
 * without this the balance was consumed and the refunded money disappeared.
 */
export function sumRedeemedCreditLegs(
  legs: Array<{ method: PaymentLegMethod; amount: Decimal }>,
): { storeCredit: Decimal; exchangeCredit: Decimal; total: Decimal } {
  let storeCredit = new Decimal(0);
  let exchangeCredit = new Decimal(0);
  for (const leg of legs) {
    if (leg.method === 'STORE_CREDIT') storeCredit = storeCredit.plus(leg.amount);
    if (leg.method === 'EXCHANGE_CREDIT') exchangeCredit = exchangeCredit.plus(leg.amount);
  }
  return {
    storeCredit,
    exchangeCredit,
    total: storeCredit.plus(exchangeCredit),
  };
}
