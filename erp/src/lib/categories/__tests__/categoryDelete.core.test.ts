import { describe, expect, it } from 'vitest';

import {
  assignedProductsReason,
  categoryDeleteBlockedReason,
} from '@/lib/categories/categoryDelete.core';

/** ARGUS #165: list and detail must explain an in-use category identically. */
describe('category delete blocking', () => {
  it('blocks a category with products and names the count', () => {
    expect(categoryDeleteBlockedReason(6)).toBe(
      '6 products assigned - reassign or delete them first',
    );
  });

  it('uses the singular form for one product', () => {
    expect(assignedProductsReason(1)).toBe(
      '1 product assigned - reassign or delete them first',
    );
  });

  it('allows deletion when no products are assigned', () => {
    expect(categoryDeleteBlockedReason(0)).toBeUndefined();
  });

  it('never suggests archiving as a way to unblock deletion', () => {
    expect(assignedProductsReason(2)).not.toContain('archive');
  });
});
