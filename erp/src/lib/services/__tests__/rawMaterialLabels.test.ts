import { describe, expect, it } from 'vitest';

import {
  dedupeLabeledOptions,
  findDuplicateRawMaterialCategoryName,
} from '@/lib/services/rawMaterial.core';

describe('raw-material label uniqueness (ARGUS #247)', () => {
  it('finds a duplicate category name case/space-insensitively', () => {
    const rows = [
      { id: 'built-in', name: 'Powders & Herbs' },
      { id: 'custom', name: 'Oils' },
    ];
    expect(findDuplicateRawMaterialCategoryName('  powders   & herbs ', rows)?.id).toBe(
      'built-in',
    );
    expect(findDuplicateRawMaterialCategoryName('Bottles', rows)).toBeNull();
  });

  it('never matches the category being edited', () => {
    expect(
      findDuplicateRawMaterialCategoryName('Oils', [{ id: 'custom', name: 'Oils' }], 'custom'),
    ).toBeNull();
  });

  it('keeps one option per display label and prefers the bound key', () => {
    const options = [
      { id: 'a', key: 'KILOGRAMS_2', name: 'Kilograms (kg)' },
      { id: 'b', key: 'KILOGRAMS', name: 'Kilograms (kg)' },
      { id: 'c', key: 'LITERS', name: 'Litres' },
    ];
    const deduped = dedupeLabeledOptions(options, 'KILOGRAMS_2');
    expect(deduped).toHaveLength(2);
    expect(deduped[0]!.key).toBe('KILOGRAMS_2');
    expect(deduped[1]!.key).toBe('LITERS');
  });
});
