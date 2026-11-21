import { describe, expect, it } from 'vitest';

import { brandDeleteBlockedReason } from '@/lib/brands/brandDelete.core';

/** ARGUS #176: the brand lock must use the shared, accurate copy. */
describe('brand delete blocking', () => {
  it('blocks an in-use brand with the shared delete wording', () => {
    expect(brandDeleteBlockedReason(4)).toBe(
      '4 products assigned - reassign or delete them first',
    );
  });

  it('uses the singular form for one product', () => {
    expect(brandDeleteBlockedReason(1)).toBe(
      '1 product assigned - reassign or delete them first',
    );
  });

  it('allows deletion when no products are assigned', () => {
    expect(brandDeleteBlockedReason(0)).toBeUndefined();
  });

  it('never tells users that archiving unlocks deletion', () => {
    expect(brandDeleteBlockedReason(4)).not.toContain('archive');
  });
});
