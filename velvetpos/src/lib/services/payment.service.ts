// payment.service provides payment creation primitives only.
// The orchestration of the full atomic sale transaction — creating Sale, SaleLines,
// and Payment records together with stock deduction — is performed in
// sale.service.createSale. Callers outside of sale.service should only use this
// module for reads and the computeChange utility.

import type { PaymentLegMethod } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { type TxClient } from '@/lib/services/inventory.service';
import Decimal from 'decimal.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreatePaymentInput {
  saleId: string;
  method: PaymentLegMethod;
  amount: Decimal;
  cardReferenceNumber?: string;
}

// ── createPayment ────────────────────────────────────────────────────────────

export async function createPayment(input: CreatePaymentInput, tx?: TxClient) {
  if (!input.amount.greaterThan(0)) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const client = tx ?? prisma;

  return client.payment.create({
    data: {
      saleId: input.saleId,
      method: input.method,
      amount: input.amount.toFixed(2),
      ...(input.cardReferenceNumber !== undefined && {
        cardReferenceNumber: input.cardReferenceNumber,
      }),
    },
  });
}

// ── getPaymentsForSale ───────────────────────────────────────────────────────

export async function getPaymentsForSale(saleId: string) {
  return prisma.payment.findMany({
    where: { saleId },
    orderBy: { createdAt: 'asc' },
  });
}

// ── computeChange ────────────────────────────────────────────────────────────

export function computeChange(totalAmount: Decimal, amountPaid: Decimal): Decimal {
  if (amountPaid.lessThan(totalAmount)) {
    throw new Error('Insufficient funds: the amount paid is less than the total due.');
  }

  return amountPaid.minus(totalAmount);
}
