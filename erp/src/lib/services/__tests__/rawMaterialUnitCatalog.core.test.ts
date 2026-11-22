import { describe, expect, it } from 'vitest';

import {
  buildRawMaterialUnitCatalog,
  resolveRawMaterialUnitLabels,
  resolveRawMaterialUnitName,
  resolveRawMaterialUnitShortLabel,
} from '@/lib/services/rawMaterialUnitCatalog.core';

/**
 * ARGUS #481: factory surfaces must use the tenant's unit labels, including
 * deactivated and soft-deleted units that a material still references.
 */
describe('raw-material unit catalog', () => {
  const catalog = buildRawMaterialUnitCatalog([
    { key: 'KILOGRAMS', name: 'Kilograms', shortLabel: 'kg', isActive: true },
    { key: 'BOTTLES', name: 'Bottles', shortLabel: 'btl', isActive: false },
    { key: 'SACHETS', name: 'Sachets', shortLabel: 'sach', isActive: false, deletedAt: new Date() },
  ]);

  it('resolves an active custom unit to its tenant labels', () => {
    expect(resolveRawMaterialUnitLabels(catalog, 'KILOGRAMS')).toEqual({
      name: 'Kilograms',
      shortLabel: 'kg',
    });
  });

  it('keeps a deactivated custom unit resolvable', () => {
    expect(resolveRawMaterialUnitShortLabel(catalog, 'BOTTLES')).toBe('btl');
    expect(resolveRawMaterialUnitName(catalog, 'BOTTLES')).toBe('Bottles');
  });

  it('keeps a soft-deleted historical unit resolvable', () => {
    expect(resolveRawMaterialUnitShortLabel(catalog, 'SACHETS')).toBe('sach');
  });

  it('applies tenant renames immediately', () => {
    const renamed = buildRawMaterialUnitCatalog([
      { key: 'KILOGRAMS', name: 'Grams', shortLabel: 'g', isActive: true },
    ]);
    expect(resolveRawMaterialUnitLabels(renamed, 'KILOGRAMS')).toEqual({
      name: 'Grams',
      shortLabel: 'g',
    });
  });

  it('prefers a live row over a duplicate deleted row for the same key', () => {
    const mixed = buildRawMaterialUnitCatalog([
      { key: 'UNITS', name: 'Old units', shortLabel: 'old', isActive: false, deletedAt: new Date() },
      { key: 'UNITS', name: 'Units', shortLabel: 'unit', isActive: false },
    ]);
    expect(resolveRawMaterialUnitShortLabel(mixed, 'UNITS')).toBe('unit');
  });

  it('falls back readably for a truly unknown key', () => {
    expect(resolveRawMaterialUnitLabels(catalog, 'SACHETS_10G')).toEqual({
      name: 'Sachets 10g',
      shortLabel: 'SACHETS_10G',
    });
  });

  it('is safe with a missing catalog', () => {
    expect(resolveRawMaterialUnitLabels(undefined, 'BOTTLES')).toEqual({
      name: 'Bottles',
      shortLabel: 'BOTTLES',
    });
  });
});
