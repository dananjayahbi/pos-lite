import { describe, expect, it } from 'vitest';

import { phoneSearchVariants } from '@/lib/delivery/search.core';

describe('phoneSearchVariants (ARGUS #268)', () => {
  it('keeps the raw term and adds the compact form', () => {
    expect(phoneSearchVariants('077 123 4567')).toEqual([
      '077 123 4567',
      '0771234567',
      '077-123-4567',
    ]);
  });

  it('expands a compact Sri Lankan mobile number to its common formats', () => {
    expect(phoneSearchVariants('0771234567')).toEqual([
      '0771234567',
      '077 123 4567',
      '077-123-4567',
    ]);
  });

  it('does not invent formats for ordinary text or short numbers', () => {
    expect(phoneSearchVariants('ORD-1001')).toEqual(['ORD-1001']);
    expect(phoneSearchVariants('12345')).toEqual(['12345']);
    expect(phoneSearchVariants('   ')).toEqual([]);
  });
});
