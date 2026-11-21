import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { assertCompletedSaleShape } from '@/lib/services/saleCompleteness.core';

function caught(fn: () => void): ApiError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected assertCompletedSaleShape to throw');
}

/**
 * ARGUS #76: four legacy COMPLETED CASH sales carried a total but no lines and
 * no payments. The invariant rejects that shape while leaving held sales and
 * legitimate zero-value sales alone.
 */
describe('assertCompletedSaleShape', () => {
  it('accepts a completed sale with a line and a payment', () => {
    expect(() =>
      assertCompletedSaleShape({
        status: 'COMPLETED',
        lineCount: 1,
        paymentCount: 1,
        totalAmount: '2500.00',
      }),
    ).not.toThrow();
  });

  it('rejects a completed sale with no line items', () => {
    const error = caught(() =>
      assertCompletedSaleShape({
        status: 'COMPLETED',
        lineCount: 0,
        paymentCount: 0,
        totalAmount: '2500.00',
      }),
    );
    expect(error.status).toBe(422);
    expect(error.code).toBe('SALE_REQUIRES_LINE');
  });

  it('rejects a completed sale with a line but no payment leg', () => {
    const error = caught(() =>
      assertCompletedSaleShape({
        status: 'COMPLETED',
        lineCount: 1,
        paymentCount: 0,
        totalAmount: '2500.00',
      }),
    );
    expect(error.status).toBe(422);
    expect(error.code).toBe('SALE_REQUIRES_PAYMENT');
  });

  it('allows a legitimate zero-value sale with no payment leg', () => {
    expect(() =>
      assertCompletedSaleShape({
        status: 'COMPLETED',
        lineCount: 1,
        paymentCount: 0,
        totalAmount: '0.00',
      }),
    ).not.toThrow();
  });

  it('does not constrain held (OPEN) or voided sales', () => {
    expect(() =>
      assertCompletedSaleShape({
        status: 'OPEN',
        lineCount: 0,
        paymentCount: 0,
        totalAmount: '0.00',
      }),
    ).not.toThrow();
    expect(() =>
      assertCompletedSaleShape({
        status: 'VOIDED',
        lineCount: 0,
        paymentCount: 0,
        totalAmount: '0.00',
      }),
    ).not.toThrow();
  });
});
