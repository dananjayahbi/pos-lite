import { describe, expect, it } from 'vitest';

import {
  canonicalCustomerTag,
  customerTagMatches,
  hasCustomerTag,
  summarizeCustomerTags,
} from '@/lib/services/customerTag.core';

/** ARGUS #333: rule tags are canonical and matched case-insensitively. */
describe('customerTag.core', () => {
  it('trims and upper-cases a tag', () => {
    expect(canonicalCustomerTag('  wholesale ')).toBe('WHOLESALE');
    expect(canonicalCustomerTag('')).toBe('');
  });

  it('de-duplicates tags case-insensitively and counts each customer once', () => {
    const tags = summarizeCustomerTags([
      ['WHOLESALE', 'wholesale', 'VIP'],
      ['Wholesale'],
      [],
    ]);

    expect(tags).toEqual([
      { tag: 'VIP', customerCount: 1 },
      { tag: 'WHOLESALE', customerCount: 2 },
    ]);
  });

  it('matches tags case-insensitively', () => {
    expect(customerTagMatches('wholesale', 'WHOLESALE')).toBe(true);
    expect(customerTagMatches('wholesale', 'VIP')).toBe(false);
    expect(customerTagMatches('', '')).toBe(false);
  });

  it('detects a tag in use across customers', () => {
    expect(hasCustomerTag([['VIP'], ['wholesale']], 'WHOLESALE')).toBe(true);
    expect(hasCustomerTag([['VIP']], 'WHOLESALE')).toBe(false);
  });
});
