import { describe, expect, it } from 'vitest';

import {
  STOCK_MOVEMENT_REASONS,
  STOCK_MOVEMENT_REASON_BADGE_VARIANT,
  STOCK_MOVEMENT_REASON_DOT_COLOR,
  STOCK_MOVEMENT_REASON_LABELS,
  isStockMovementReason,
  parseStockMovementReasons,
  serializeStockMovementReasons,
  stockMovementReasonLabel,
  toggleStockMovementReason,
} from '@/lib/constants/stock-movement';

/**
 * ARGUS #183 - Movement History must know every StockMovementReason the Prisma
 * enum can write. These tests pin the shared config that the chips, badges and
 * CSV export all read.
 */
describe('stock movement reason config', () => {
  it('lists all 13 enum reasons in schema order', () => {
    expect([...STOCK_MOVEMENT_REASONS]).toEqual([
      'FOUND',
      'DAMAGED',
      'STOLEN',
      'DATA_ERROR',
      'RETURNED_TO_SUPPLIER',
      'INITIAL_STOCK',
      'SALE_RETURN',
      'PURCHASE_RECEIVED',
      'STOCK_TAKE_ADJUSTMENT',
      'SALE',
      'VOID_REVERSAL',
      'MANUFACTURED',
      'WEBSITE_ORDER',
    ]);
  });

  it('labels, colours and badges every reason', () => {
    for (const reason of STOCK_MOVEMENT_REASONS) {
      expect(STOCK_MOVEMENT_REASON_LABELS[reason], reason).toBeTruthy();
      expect(STOCK_MOVEMENT_REASON_BADGE_VARIANT[reason], reason).toBeTruthy();
      expect(STOCK_MOVEMENT_REASON_DOT_COLOR[reason], reason).toMatch(/^bg-/);
    }
  });

  it('uses readable labels for every reason, never the raw enum token', () => {
    for (const reason of STOCK_MOVEMENT_REASONS) {
      const label = stockMovementReasonLabel(reason);
      expect(label).not.toBe(reason);
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it('labels SALE and VOID_REVERSAL for the CSV export (regression)', () => {
    expect(stockMovementReasonLabel('SALE')).toBe('Sale');
    expect(stockMovementReasonLabel('VOID_REVERSAL')).toBe('Void Reversal');
    expect(stockMovementReasonLabel('MANUFACTURED')).toBe('Manufactured');
    expect(stockMovementReasonLabel('WEBSITE_ORDER')).toBe('Website Order');
  });

  it('falls back to the raw value for a token outside the config', () => {
    expect(stockMovementReasonLabel('FUTURE_REASON')).toBe('FUTURE_REASON');
    expect(stockMovementReasonLabel(null)).toBe('');
    expect(isStockMovementReason('MANUFACTURED')).toBe(true);
    expect(isStockMovementReason('FUTURE_REASON')).toBe(false);
  });
});

describe('stock movement reason filter parsing', () => {
  it('treats a missing or empty param as every reason', () => {
    expect(parseStockMovementReasons(null)).toHaveLength(13);
    expect(parseStockMovementReasons(undefined)).toHaveLength(13);
    expect(parseStockMovementReasons('')).toHaveLength(13);
    expect(parseStockMovementReasons(' , ,')).toHaveLength(13);
  });

  it('keeps only known reasons in canonical order and drops duplicates', () => {
    expect(parseStockMovementReasons('WEBSITE_ORDER,NOPE,FOUND,FOUND')).toEqual([
      'FOUND',
      'WEBSITE_ORDER',
    ]);
  });

  it('serializes all or nothing to null (no filter)', () => {
    expect(serializeStockMovementReasons(STOCK_MOVEMENT_REASONS)).toBeNull();
    expect(serializeStockMovementReasons([])).toBeNull();
    expect(serializeStockMovementReasons(['SALE'])).toBe('SALE');
    expect(serializeStockMovementReasons(['WEBSITE_ORDER', 'SALE'])).toBe('SALE,WEBSITE_ORDER');
  });
});

describe('stock movement reason chip toggling', () => {
  it('excludes only the clicked chip by default, keeping the newer reasons', () => {
    const value = toggleStockMovementReason(null, 'DAMAGED');
    expect(value).toBeTypeOf('string');

    const selected = parseStockMovementReasons(value);
    expect(selected).toHaveLength(12);
    expect(selected).not.toContain('DAMAGED');
    // The regression: a default-selection toggle must not drop enum members
    // that the old 11-entry chip list did not know about.
    expect(selected).toContain('MANUFACTURED');
    expect(selected).toContain('WEBSITE_ORDER');
  });

  it('adds a reason to a partial URL without resetting the filter', () => {
    const value = toggleStockMovementReason('MANUFACTURED', 'SALE');
    expect(value).toBe('SALE,MANUFACTURED');
  });

  it('restores the no-filter default when every reason is selected', () => {
    const allButOne = STOCK_MOVEMENT_REASONS.filter((reason) => reason !== 'SALE').join(',');
    expect(toggleStockMovementReason(allButOne, 'SALE')).toBeNull();
  });

  it('normalizes an all-excluded selection to the default feed', () => {
    expect(toggleStockMovementReason('MANUFACTURED', 'MANUFACTURED')).toBeNull();
  });
});
