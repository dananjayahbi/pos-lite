import { describe, expect, it } from 'vitest';

import { ProductListQuerySchema } from '@/lib/validators/product.validators';

/**
 * ARGUS #141: the inventory form chips set `?forms=OIL`, but the query schema
 * used to drop the parameter, so the API silently ignored the filter.
 */
describe('ProductListQuerySchema', () => {
  it('keeps the comma-separated forms filter', () => {
    const parsed = ProductListQuerySchema.parse({ forms: 'OIL,POWDER' });

    expect(parsed.forms).toBe('OIL,POWDER');
  });

  it('accepts requests without a forms filter', () => {
    const parsed = ProductListQuerySchema.parse({});

    expect(parsed.forms).toBeUndefined();
  });
});
