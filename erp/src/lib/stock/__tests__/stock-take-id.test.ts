import { describe, expect, it } from 'vitest';

import { stockTakeIdReference, stockTakeIdValue } from '@/lib/stock/stock-take-id';

describe('stock-take identifiers', () => {
  const id = 'cmvtdxsw0000abcdefghijklmnopqrstuv';

  it('keeps the full id for audit/copy', () => {
    expect(stockTakeIdValue(`  ${id}  `)).toBe(id);
  });

  it('keeps both ends of a long id so prefixes cannot collide visually', () => {
    const reference = stockTakeIdReference(id);
    expect(reference.startsWith('cmvtdxsw')).toBe(true);
    expect(reference.endsWith(id.slice(-4))).toBe(true);
    expect(reference).not.toBe(id);
  });

  it('does not shorten an id that already fits', () => {
    expect(stockTakeIdReference('abc123')).toBe('abc123');
  });
});
