import { describe, expect, it } from 'vitest';

import {
  STOCK_TAKE_COUNT_NEGATIVE_MESSAGE,
  STOCK_TAKE_COUNT_WHOLE_MESSAGE,
  parseStockTakeCountInput,
} from '@/lib/services/stockTakeCount.core';

/**
 * ARGUS #208 - blank means "not counted" (null); negative/non-integer is an
 * explicit error instead of a silent drop.
 */
describe('stock-take count input', () => {
  it.each([null, undefined, '', '   '])('treats %j as clear (not counted)', (raw) => {
    expect(parseStockTakeCountInput(raw)).toEqual({ kind: 'clear' });
  });

  it('accepts non-negative whole numbers from strings and numbers', () => {
    expect(parseStockTakeCountInput('0')).toEqual({ kind: 'set', value: 0 });
    expect(parseStockTakeCountInput(' 42 ')).toEqual({ kind: 'set', value: 42 });
    expect(parseStockTakeCountInput('+7')).toEqual({ kind: 'set', value: 7 });
    expect(parseStockTakeCountInput(12)).toEqual({ kind: 'set', value: 12 });
    expect(parseStockTakeCountInput(0)).toEqual({ kind: 'set', value: 0 });
  });

  it('reports a negative entry instead of dropping it', () => {
    expect(parseStockTakeCountInput('-1')).toEqual({
      kind: 'invalid',
      message: STOCK_TAKE_COUNT_NEGATIVE_MESSAGE,
    });
    expect(parseStockTakeCountInput(-5)).toEqual({
      kind: 'invalid',
      message: STOCK_TAKE_COUNT_NEGATIVE_MESSAGE,
    });
  });

  it('reports fractional, NaN and non-numeric entries', () => {
    for (const raw of ['1.5', '1e3', 'abc', 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseStockTakeCountInput(raw), String(raw)).toEqual({
        kind: 'invalid',
        message: STOCK_TAKE_COUNT_WHOLE_MESSAGE,
      });
    }
  });
});
