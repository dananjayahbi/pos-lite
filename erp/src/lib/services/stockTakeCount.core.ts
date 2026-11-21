/**
 * ARGUS #208 - interpret the stock-take count input.
 *
 * A blank input means "not counted" (`null`), so clearing a mistakenly entered
 * count removes it from progress and from the stored discrepancy. A negative
 * or non-integer entry is an explicit error, not a silent no-op: the caller
 * shows the message and leaves the stored count untouched.
 *
 * Pure so the session UI and the API validation describe the same rule.
 */

export type StockTakeCountInputResult =
  | { kind: 'clear' }
  | { kind: 'set'; value: number }
  | { kind: 'invalid'; message: string };

export const STOCK_TAKE_COUNT_NEGATIVE_MESSAGE = 'Counted quantity cannot be negative';
export const STOCK_TAKE_COUNT_WHOLE_MESSAGE = 'Counted quantity must be a whole number';

export function parseStockTakeCountInput(
  raw: string | number | null | undefined,
): StockTakeCountInputResult {
  if (raw === null || raw === undefined) return { kind: 'clear' };

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return { kind: 'invalid', message: STOCK_TAKE_COUNT_WHOLE_MESSAGE };
    }
    if (raw < 0) return { kind: 'invalid', message: STOCK_TAKE_COUNT_NEGATIVE_MESSAGE };
    return { kind: 'set', value: raw };
  }

  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'clear' };

  // Accept a leading sign so a typed "-5" gets the negative message instead
  // of the generic "whole number" one.
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return { kind: 'invalid', message: STOCK_TAKE_COUNT_WHOLE_MESSAGE };
  }

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    return { kind: 'invalid', message: STOCK_TAKE_COUNT_WHOLE_MESSAGE };
  }
  if (value < 0) return { kind: 'invalid', message: STOCK_TAKE_COUNT_NEGATIVE_MESSAGE };
  return { kind: 'set', value };
}
