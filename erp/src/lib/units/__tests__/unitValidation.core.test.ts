import { describe, expect, it } from 'vitest';

import {
  deriveUnitShortLabel,
  findDuplicateUnitLabel,
  hasAlphanumeric,
  normalizeUnitLabel,
} from '@/lib/units/unitValidation.core';

/** ARGUS #482: unit names and short labels must be unambiguous. */
describe('unit label validation', () => {
  const rows = [
    { id: 'u1', name: 'Kilograms', shortLabel: 'kg' },
    { id: 'u2', name: 'Liters', shortLabel: 'L' },
  ];

  it('normalises case and whitespace', () => {
    expect(normalizeUnitLabel('  Kilo  Grams ')).toBe('kilo grams');
  });

  it('rejects a duplicate name regardless of case or padding', () => {
    expect(findDuplicateUnitLabel({ name: 'kilograms' }, rows)).toEqual({
      field: 'name',
      existingName: 'Kilograms',
    });
    expect(findDuplicateUnitLabel({ name: '  Kilograms  ' }, rows)?.field).toBe('name');
  });

  it('rejects a duplicate short label', () => {
    expect(findDuplicateUnitLabel({ shortLabel: 'KG' }, rows)).toEqual({
      field: 'shortLabel',
      existingName: 'Kilograms',
    });
  });

  it('allows a distinct label and skips the unit being edited', () => {
    expect(findDuplicateUnitLabel({ name: 'Bottles', shortLabel: 'btl' }, rows)).toBeNull();
    expect(
      findDuplicateUnitLabel({ name: 'kilograms', shortLabel: 'kg' }, rows, 'u1'),
    ).toBeNull();
  });

  it('requires at least one letter or digit in a name', () => {
    expect(hasAlphanumeric('Bottles')).toBe(true);
    expect(hasAlphanumeric('500ml')).toBe(true);
    expect(hasAlphanumeric('---')).toBe(false);
    expect(hasAlphanumeric('   ')).toBe(false);
  });

  it('never reports a blank input as a duplicate', () => {
    expect(findDuplicateUnitLabel({ name: '   ', shortLabel: '' }, rows)).toBeNull();
  });
});

/** ARGUS #486: the derived short label must be a complete label, not cut mid-word. */
describe('deriveUnitShortLabel', () => {
  it('keeps a short name complete', () => {
    expect(deriveUnitShortLabel('Bottles Of 500ml')).toBe('Bottles Of 500ml');
  });

  it('drops whole words at the 20-character boundary', () => {
    expect(deriveUnitShortLabel('Bottles Of 500ml Assorted')).toBe('Bottles Of 500ml');
  });

  it('collapses extra whitespace and trims', () => {
    expect(deriveUnitShortLabel('  Bottles   Of 500ml  ')).toBe('Bottles Of 500ml');
  });

  it('hard-cuts only a single word longer than the cap', () => {
    expect(deriveUnitShortLabel('Supercalifragilisticexpialidocious')).toHaveLength(20);
  });

  it('falls back to "unit" for a blank name', () => {
    expect(deriveUnitShortLabel('   ')).toBe('unit');
  });
});
