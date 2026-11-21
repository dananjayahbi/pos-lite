import { describe, expect, it } from 'vitest';

import {
  unitDisplayChanged,
  unitRenameWarning,
} from '@/lib/services/rawMaterialUnitRename.core';

/**
 * ARGUS #480: renaming a unit must not silently reinterpret stored quantities.
 * The UI only saves after the operator acknowledges the labels are display-only.
 */
describe('unit rename confirmation', () => {
  const original = { name: 'Kilograms', shortLabel: 'kg' };

  it('requires confirmation when the name changes', () => {
    expect(unitDisplayChanged(original, { name: 'Grams', shortLabel: 'kg' })).toBe(true);
  });

  it('requires confirmation when only the short label changes', () => {
    expect(unitDisplayChanged(original, { name: 'Kilograms', shortLabel: 'g' })).toBe(true);
  });

  it('does not require confirmation when neither display field changes', () => {
    expect(unitDisplayChanged(original, { name: 'Kilograms', shortLabel: 'kg' })).toBe(false);
  });

  it('ignores surrounding whitespace when deciding whether a change happened', () => {
    expect(unitDisplayChanged(original, { name: '  Kilograms ', shortLabel: ' kg ' })).toBe(false);
  });

  it('states that quantities are not converted and the key stays stable', () => {
    const warning = unitRenameWarning('KILOGRAMS');
    expect(warning).toContain('does not convert');
    expect(warning).toContain('KILOGRAMS');
    expect(warning).toContain('12 stays 12');
  });
});
