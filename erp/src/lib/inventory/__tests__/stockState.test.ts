import { describe, expect, it } from 'vitest';

import {
  getProductStockState,
  getVariantStockState,
  matchesStockStatusFilter,
  resolveProductStatusBadge,
} from '@/lib/inventory/stockState';

/**
 * ARGUS #142: the badge and the low/out-of-stock filters used to disagree
 * (any-zero vs all-zero, and whether 0 counts as low). These tests pin the
 * single shared rule.
 */
describe('stock state rule', () => {
  it('classifies a variant at or below zero as out of stock', () => {
    expect(getVariantStockState({ stockQuantity: 0, lowStockThreshold: 5 })).toBe('OUT_OF_STOCK');
    expect(getVariantStockState({ stockQuantity: -2, lowStockThreshold: 5 })).toBe('OUT_OF_STOCK');
  });

  it('classifies a positive variant within its threshold as low stock', () => {
    expect(getVariantStockState({ stockQuantity: 5, lowStockThreshold: 5 })).toBe('LOW_STOCK');
    expect(getVariantStockState({ stockQuantity: 1, lowStockThreshold: 5 })).toBe('LOW_STOCK');
  });

  it('classifies a variant above its threshold as in stock', () => {
    expect(getVariantStockState({ stockQuantity: 6, lowStockThreshold: 5 })).toBe('IN_STOCK');
  });

  it('only marks a product out of stock when every variant is out', () => {
    expect(
      getProductStockState([
        { stockQuantity: 0, lowStockThreshold: 5 },
        { stockQuantity: 0, lowStockThreshold: 5 },
      ]),
    ).toBe('OUT_OF_STOCK');

    expect(
      getProductStockState([
        { stockQuantity: 0, lowStockThreshold: 5 },
        { stockQuantity: 20, lowStockThreshold: 5 },
      ]),
    ).toBe('IN_STOCK');
  });

  it('marks a product low when a sellable variant is at its threshold', () => {
    expect(
      getProductStockState([
        { stockQuantity: 2, lowStockThreshold: 5 },
        { stockQuantity: 8, lowStockThreshold: 5 },
      ]),
    ).toBe('LOW_STOCK');
  });

  it('does not treat a zero variant as low stock', () => {
    expect(
      getProductStockState([
        { stockQuantity: 0, lowStockThreshold: 5 },
        { stockQuantity: 20, lowStockThreshold: 5 },
      ]),
    ).toBe('IN_STOCK');
  });

  it('classifies a product without variants as out of stock (ARGUS #153)', () => {
    expect(getProductStockState([])).toBe('OUT_OF_STOCK');
    expect(matchesStockStatusFilter([], 'out_of_stock')).toBe(true);
    expect(matchesStockStatusFilter([], 'low_stock')).toBe(false);
  });

  it('classifies a product whose only variant has negative stock as out of stock', () => {
    expect(
      getProductStockState([{ stockQuantity: -4, lowStockThreshold: 5 }]),
    ).toBe('OUT_OF_STOCK');
  });

  it('drives both inventory filters from the same rule', () => {
    const low = [{ stockQuantity: 3, lowStockThreshold: 5 }];
    const out = [{ stockQuantity: 0, lowStockThreshold: 5 }];

    expect(matchesStockStatusFilter(low, 'low_stock')).toBe(true);
    expect(matchesStockStatusFilter(low, 'out_of_stock')).toBe(false);
    expect(matchesStockStatusFilter(out, 'out_of_stock')).toBe(true);
    expect(matchesStockStatusFilter(out, 'low_stock')).toBe(false);
  });
});

/**
 * ARGUS #149: the Deleted view listed 37 soft-deleted products, all badged
 * "Low Stock" because the badge ignored the row's lifecycle state.
 */
describe('product status badge', () => {
  it('badges a soft-deleted row as Deleted, never Low Stock', () => {
    expect(
      resolveProductStatusBadge({
        isDeleted: true,
        isArchived: false,
        variants: [{ stockQuantity: 1, lowStockThreshold: 5 }],
      }),
    ).toBe('DELETED');
    expect(
      resolveProductStatusBadge({
        isDeleted: true,
        isArchived: false,
        variants: [{ stockQuantity: 0, lowStockThreshold: 5 }],
      }),
    ).toBe('DELETED');
  });

  it('keeps Deleted ahead of Archived for archived soft-deleted rows', () => {
    expect(
      resolveProductStatusBadge({
        isDeleted: true,
        isArchived: true,
        variants: [{ stockQuantity: 9, lowStockThreshold: 5 }],
      }),
    ).toBe('DELETED');
  });

  it('still uses the shared stock rule for live rows', () => {
    expect(
      resolveProductStatusBadge({
        isArchived: false,
        variants: [{ stockQuantity: 9, lowStockThreshold: 5 }],
      }),
    ).toBe('ACTIVE');
    expect(
      resolveProductStatusBadge({
        isArchived: false,
        variants: [{ stockQuantity: 3, lowStockThreshold: 5 }],
      }),
    ).toBe('LOW_STOCK');
    expect(
      resolveProductStatusBadge({
        isArchived: false,
        variants: [{ stockQuantity: 0, lowStockThreshold: 5 }],
      }),
    ).toBe('OUT_OF_STOCK');
    expect(
      resolveProductStatusBadge({
        isArchived: true,
        variants: [{ stockQuantity: 0, lowStockThreshold: 5 }],
      }),
    ).toBe('ARCHIVED');
  });
});
