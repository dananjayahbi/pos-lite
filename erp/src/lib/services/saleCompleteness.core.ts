import Decimal from 'decimal.js';

import { ApiError } from '@/lib/api/errors';
import type { SaleStatus } from '@/generated/prisma/client';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface CompletedSaleShape {
  status: SaleStatus;
  lineCount: number;
  paymentCount: number;
  totalAmount: Decimalish;
}

/**
 * Guard the shape of a persisted sale (ARGUS #76).
 *
 * A COMPLETED sale is a financial document: it must account for goods/services
 * (at least one line) and, when it has a positive total, for the money that
 * settled it (at least one payment leg). The historical appointment conversion
 * wrote bare `COMPLETED` CASH sales with a total but no lines and no payments;
 * they counted as revenue with nothing sold and nothing tendered.
 *
 * Deliberately shape-only: a legitimate zero-value sale (replacement, fully
 * discounted cart) has a line but no payment leg, so payments are required only
 * when `totalAmount > 0`. OPEN (held) and VOIDED sales are partial by design and
 * are not constrained here.
 */
export function assertCompletedSaleShape(input: CompletedSaleShape): void {
  if (input.status !== 'COMPLETED') return;

  if (input.lineCount < 1) {
    throw new ApiError(
      422,
      'SALE_REQUIRES_LINE',
      'A completed sale must have at least one line item - zero-line sales cannot record revenue',
    );
  }

  const total = new Decimal(input.totalAmount.toString());
  if (total.greaterThan(0) && input.paymentCount < 1) {
    throw new ApiError(
      422,
      'SALE_REQUIRES_PAYMENT',
      'A completed sale with a non-zero total must have at least one payment - record the tender or the zero-value reason',
    );
  }
}
