import { describe, it, expect } from 'vitest';
import {
  applyQuantityDelta,
  getRawMaterialCategoryLabel,
  getRawMaterialStockStatus,
  getUnitLabel,
  getUnitShortLabel,
  humanizeRawMaterialCategoryKey,
  isRawMaterialLowStock,
  RAW_MATERIAL_CATEGORY_LABELS,
  RAW_MATERIAL_CATEGORIES,
  slugifyRawMaterialCategoryKey,
  UNIT_LABELS,
  UNITS,
} from '@/lib/services/rawMaterial.core';

describe('rawMaterial.core — categories & units', () => {
  it('exposes all three built-in raw material categories', () => {
    expect(RAW_MATERIAL_CATEGORIES).toEqual([
      'OILS_LIQUIDS',
      'POWDERS_HERBS',
      'CHEMICALS',
    ]);
  });

  it('exposes liters, kilograms and unit-count units', () => {
    expect(UNITS).toEqual(['LITERS', 'KILOGRAMS', 'UNITS']);
  });

  it('returns human-readable category labels', () => {
    expect(getRawMaterialCategoryLabel('OILS_LIQUIDS')).toBe('Oils & Liquids');
    expect(getRawMaterialCategoryLabel('POWDERS_HERBS')).toBe('Powders & Herbs');
    expect(getRawMaterialCategoryLabel('CHEMICALS')).toBe('Chemicals');
    expect(Object.keys(RAW_MATERIAL_CATEGORY_LABELS).length).toBe(3);
  });

  it('falls back to a humanized label for tenant-defined categories', () => {
    expect(getRawMaterialCategoryLabel('BOTTLES_CAPS')).toBe('Bottles Caps');
  });

  it('returns unit labels and short labels', () => {
    expect(getUnitLabel('LITERS')).toBe('Liters');
    expect(getUnitLabel('KILOGRAMS')).toBe('Kilograms');
    expect(getUnitLabel('UNITS')).toBe('Units');
    expect(getUnitShortLabel('LITERS')).toBe('L');
    expect(getUnitShortLabel('KILOGRAMS')).toBe('kg');
    expect(getUnitShortLabel('UNITS')).toBe('unit');
    expect(Object.keys(UNIT_LABELS).length).toBe(3);
  });
});

describe('rawMaterial.core — custom category keys', () => {
  it('slugs category names into stable uppercase keys', () => {
    expect(slugifyRawMaterialCategoryKey('Bottles & Caps')).toBe('BOTTLES_CAPS');
    expect(slugifyRawMaterialCategoryKey('  Labels  ')).toBe('LABELS');
    expect(slugifyRawMaterialCategoryKey('Boxes/Containers')).toBe('BOXES_CONTAINERS');
  });

  it('falls back to CATEGORY when a name has no alphanumerics', () => {
    expect(slugifyRawMaterialCategoryKey('***')).toBe('CATEGORY');
  });

  it('humanizes keys when no stored display name is available', () => {
    expect(humanizeRawMaterialCategoryKey('BOTTLES_CAPS')).toBe('Bottles Caps');
    expect(humanizeRawMaterialCategoryKey('OILS_LIQUIDS')).toBe('Oils Liquids');
  });
});

describe('rawMaterial.core — stock status', () => {
  it('classifies zero quantity as OUT', () => {
    expect(getRawMaterialStockStatus(0, 5)).toBe('OUT');
    expect(getRawMaterialStockStatus(-2, 5)).toBe('OUT');
  });

  it('classifies quantity at or below a positive threshold as LOW', () => {
    expect(getRawMaterialStockStatus(5, 5)).toBe('LOW');
    expect(getRawMaterialStockStatus(3, 10)).toBe('LOW');
  });

  it('classifies quantity above threshold as OK', () => {
    expect(getRawMaterialStockStatus(20, 5)).toBe('OK');
  });

  it('ignores a zero threshold when quantity is positive', () => {
    expect(getRawMaterialStockStatus(10, 0)).toBe('OK');
  });

  it('isLowStock returns true only when not OK', () => {
    expect(isRawMaterialLowStock(0, 5)).toBe(true);
    expect(isRawMaterialLowStock(5, 5)).toBe(true);
    expect(isRawMaterialLowStock(20, 5)).toBe(false);
  });
});

describe('rawMaterial.core — quantity arithmetic', () => {
  it('adds a positive delta', () => {
    expect(applyQuantityDelta(10, 5)).toBe(15);
  });

  it('subtracts a delta that stays non-negative', () => {
    expect(applyQuantityDelta(10, -4)).toBe(6);
  });

  it('rejects a delta that would drop below zero', () => {
    expect(() => applyQuantityDelta(3, -5)).toThrow('Insufficient stock');
  });

  it('allows a delta that lands exactly at zero', () => {
    expect(applyQuantityDelta(3, -3)).toBe(0);
  });
});
