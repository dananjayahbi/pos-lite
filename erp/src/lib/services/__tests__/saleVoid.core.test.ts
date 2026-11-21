import { describe, expect, it } from 'vitest';

import { assertSaleVoidable } from '@/lib/services/saleVoid.core';
import { ApiError } from '@/lib/api/errors';

/** ARGUS #94: a returned sale must not be voided (double restock + over-refund). */
describe('assertSaleVoidable', () => {
  it('allows a completed sale with no returns', () => {
    expect(() =>
      assertSaleVoidable({ status: 'COMPLETED', completedReturnCount: 0 }),
    ).not.toThrow();
  });

  it('rejects a sale that has completed returns', () => {
    try {
      assertSaleVoidable({ status: 'COMPLETED', completedReturnCount: 1 });
      throw new Error('expected assertSaleVoidable to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).code).toBe('SALE_HAS_RETURNS');
    }
  });

  it('rejects a sale that is not completed', () => {
    expect(() => assertSaleVoidable({ status: 'VOIDED', completedReturnCount: 0 })).toThrow(
      'Only completed sales can be voided',
    );
    expect(() => assertSaleVoidable({ status: 'OPEN', completedReturnCount: 0 })).toThrow(
      'Only completed sales can be voided',
    );
  });
});
