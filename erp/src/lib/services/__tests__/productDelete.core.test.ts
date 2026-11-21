import { describe, expect, it } from 'vitest';

import { assertProductHasNoStock } from '@/lib/services/productDelete.core';
import { ApiError } from '@/lib/api/errors';

/** ARGUS #137: soft-deleting stock silently wrote it off the balance sheet. */
describe('assertProductHasNoStock', () => {
  it('allows deletion when every variant is out of stock', () => {
    expect(() => assertProductHasNoStock(0)).not.toThrow();
  });

  it('blocks deletion while units remain and names the count', () => {
    try {
      assertProductHasNoStock(65);
      throw new Error('expected assertProductHasNoStock to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).code).toBe('PRODUCT_HAS_STOCK');
      expect((error as ApiError).message).toContain('65 units');
    }
  });

  it('uses the singular form for one unit', () => {
    try {
      assertProductHasNoStock(1);
    } catch (error) {
      expect((error as ApiError).message).toContain('1 unit in stock');
    }
  });
});
