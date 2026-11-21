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
  /** Amount still to collect after store credit. */
  payableAmount: Decimal;
  creditAmount: Decimal;
  cardAmount?: Decimal | undefined;
  splitLegMethod?: 'CARD' | 'LANKAQR' | undefined;
}): SaleTenderLeg[] {
  const legs: SaleTenderLeg[] = [];
  const payable = input.payableAmount;

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
        // Not a collectable tender: any payable amount must use cash/card/QR.
        break;
    }
  }

  if (input.creditAmount.greaterThan(0)) {
    legs.push({ method: 'STORE_CREDIT', amount: input.creditAmount });
  }

  return legs;
}
