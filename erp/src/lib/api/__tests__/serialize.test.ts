import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

import { serializeMoney, serializeMoneyOrNull, serializeNumber } from '@/lib/api/serialize';
import { zPrice } from '@/lib/validators/shared';

describe('INF-04 serializeMoney', () => {
  it('serializes Decimal-like values to 2-dp strings', () => {
    expect(serializeMoney(new Decimal('0.75'))).toBe('0.75');
    expect(serializeMoney(new Decimal('1890'))).toBe('1890.00');
    expect(serializeMoney(new Decimal('1890.005'))).toBe('1890.01'); // ROUND_HALF_UP
    expect(serializeMoney('12.3')).toBe('12.30');
    expect(serializeMoney(7)).toBe('7.00');
  });

  it('handles the big end and zero', () => {
    expect(serializeMoney(new Decimal('999999999.99'))).toBe('999999999.99');
    expect(serializeMoney(0)).toBe('0.00');
    expect(serializeMoney(null)).toBe('0.00');
  });

  it('OrNull keeps null distinct from zero', () => {
    expect(serializeMoneyOrNull(null)).toBeNull();
    expect(serializeMoneyOrNull(undefined)).toBeNull();
    expect(serializeMoneyOrNull(new Decimal('0'))).toBe('0.00');
  });

  it('serializeNumber tolerates garbage', () => {
    expect(serializeNumber(new Decimal('2.5'))).toBe(2.5);
    expect(serializeNumber(null)).toBeNull();
  });
});

describe('INF-04 zPrice', () => {
  it('accepts string-or-number with ≤2 decimals', () => {
    expect(zPrice().parse('1890.00')).toBe(1890);
    expect(zPrice().parse(12.5)).toBe(12.5);
    expect(zPrice().parse('0')).toBe(0);
    expect(zPrice().parse('999999999.99')).toBe(999999999.99);
  });

  it('rejects 3-dp, NaN/Infinity, empty, negatives', () => {
    expect(zPrice().safeParse('1.234').success).toBe(false);
    expect(zPrice().safeParse('NaN').success).toBe(false);
    expect(zPrice().safeParse(Infinity).success).toBe(false);
    expect(zPrice().safeParse('').success).toBe(false);
    expect(zPrice().safeParse(-1).success).toBe(false);
  });

  it('allowNegative accepts negatives but still enforces 2dp', () => {
    expect(zPrice({ allowNegative: true }).safeParse('-5.25').success).toBe(true);
    expect(zPrice({ allowNegative: true }).safeParse('-5.255').success).toBe(false);
  });
});
