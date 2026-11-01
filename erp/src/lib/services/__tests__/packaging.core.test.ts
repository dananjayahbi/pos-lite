import { describe, it, expect } from 'vitest';

import {
  buildPackagingSkuBase,
  isPackagingItemLowStock,
  nextAvailablePackagingSku,
  packagingCategoryLabel,
  packagingConsumptionUnits,
  packagingQuantityLabel,
} from '@/lib/services/packaging.core';
import {
  DEFAULT_PACKAGING_CATEGORIES,
  comparePackagingItems,
  getPackagingCategoryLabel,
  getPackagingUnitShortLabel,
  humanizePackagingCategoryKey,
  slugifyPackagingCategoryKey,
} from '@/lib/constants/packaging';

describe('packagingConsumptionUnits', () => {
  it('rounds fractional per-parcel rates half-up', () => {
    expect(packagingConsumptionUnits(1.6)).toBe(2);
    expect(packagingConsumptionUnits(2.4)).toBe(2);
    expect(packagingConsumptionUnits('0.5')).toBe(1);
  });

  it('never deducts less than one unit when a consumption is configured', () => {
    expect(packagingConsumptionUnits(0.1)).toBe(1);
  });

  it('deducts nothing for a zero or negative rate', () => {
    expect(packagingConsumptionUnits(0)).toBe(0);
    expect(packagingConsumptionUnits(-2)).toBe(0);
  });

  it('keeps whole rates whole', () => {
    expect(packagingConsumptionUnits(3)).toBe(3);
  });
});

describe('buildPackagingSkuBase', () => {
  it('derives a stable category + name stem', () => {
    expect(buildPackagingSkuBase('BUBBLE_WRAP', 'Bubble Wrap 50m')).toBe('BUBB-BUBBLE-WRAP-50M');
  });

  it('collapses separators and trims edges', () => {
    expect(buildPackagingSkuBase('TAPE', '  Brown  48mm / 100m  ')).toBe('TAPE-BROWN-48MM-100M');
  });

  it('falls back to ITEM when the name has no alphanumerics', () => {
    expect(buildPackagingSkuBase('LABEL', 'ටේප්')).toBe('LABE-ITEM');
  });
});

describe('nextAvailablePackagingSku', () => {
  it('returns the base when free', () => {
    expect(nextAvailablePackagingSku('PM-1', [])).toBe('PM-1');
  });

  it('suffixes around taken values', () => {
    expect(nextAvailablePackagingSku('PM-1', ['PM-1', 'PM-1-2'])).toBe('PM-1-3');
  });
});

describe('low-stock + label helpers', () => {
  it('treats quantity at or below the threshold as low', () => {
    expect(isPackagingItemLowStock(5, 5)).toBe(true);
    expect(isPackagingItemLowStock(4, 5)).toBe(true);
    expect(isPackagingItemLowStock(6, 5)).toBe(false);
  });

  it('prefers the tenant category name and falls back to the built-in label', () => {
    expect(packagingCategoryLabel('COURIER_BAGS')).toBe('Courier Bags');
    expect(packagingCategoryLabel('POLYMAILER', new Map([['POLYMAILER', 'Mailers']]))).toBe(
      'Mailers',
    );
  });

  it('renders quantity with a compact unit suffix', () => {
    expect(packagingQuantityLabel(10, 'METER')).toBe('10 m');
    expect(packagingQuantityLabel(3, 'PIECE')).toBe('3 pcs');
    expect(getPackagingUnitShortLabel('BOX')).toBe('boxes');
  });
});

describe('category constants', () => {
  it('ships the five built-in categories', () => {
    expect(DEFAULT_PACKAGING_CATEGORIES.map((c) => c.key)).toEqual([
      'POLYMAILER',
      'TAPE',
      'LABEL',
      'BUBBLE_WRAP',
      'OTHER',
    ]);
  });

  it('slugifies display names into stable keys', () => {
    expect(slugifyPackagingCategoryKey('Courier Bags')).toBe('COURIER_BAGS');
    expect(slugifyPackagingCategoryKey('  Boxes / Containers  ')).toBe('BOXES_CONTAINERS');
  });

  it('humanises custom keys and labels built-ins', () => {
    expect(humanizePackagingCategoryKey('COURIER_BAGS')).toBe('Courier Bags');
    expect(getPackagingCategoryLabel('BUBBLE_WRAP')).toBe('Bubble Wrap');
    expect(getPackagingCategoryLabel('COURIER_BAGS')).toBe('Courier Bags');
  });

  it('orders items by category then name', () => {
    const items = [
      { category: 'TAPE', name: 'B' },
      { category: 'LABEL', name: 'Z' },
      { category: 'LABEL', name: 'A' },
    ];
    expect(items.slice().sort(comparePackagingItems)).toEqual([
      { category: 'LABEL', name: 'A' },
      { category: 'LABEL', name: 'Z' },
      { category: 'TAPE', name: 'B' },
    ]);
  });
});
