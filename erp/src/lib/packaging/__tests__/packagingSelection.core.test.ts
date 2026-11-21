import { describe, expect, it } from 'vitest';

import {
  packagingSelectionTotals,
  suggestedPackagingItemIds,
  togglePackagingItemId,
  type PackagingSelectionOption,
} from '@/lib/packaging/packagingSelection.core';

const options: PackagingSelectionOption[] = [
  { id: 'poly', name: 'Polymailer', autoDeduct: true, consumptionPerParcel: '1' },
  { id: 'tape', name: 'Tape', autoDeduct: true, consumptionPerParcel: '0.5' },
  { id: 'label', name: 'Label', autoDeduct: false, consumptionPerParcel: null },
  { id: 'wrap', name: 'Bubble wrap', autoDeduct: false, consumptionPerParcel: '2' },
];

/** ARGUS #283: selection is explicit per delivery; auto-deduct is only a default. */
describe('packaging selection', () => {
  it('suggests only auto-deduct items by default', () => {
    expect(suggestedPackagingItemIds(options)).toEqual(['poly', 'tape']);
  });

  it('adds a manually selected item in option order', () => {
    expect(togglePackagingItemId(['poly'], 'wrap', options)).toEqual(['poly', 'wrap']);
  });

  it('removes an item that is not used for this parcel', () => {
    expect(togglePackagingItemId(['poly', 'tape'], 'tape', options)).toEqual(['poly']);
  });

  it('totals only the selected per-parcel rates', () => {
    expect(packagingSelectionTotals(options, ['poly', 'tape'])).toEqual({
      selectedCount: 2,
      unitsPerParcel: 1.5,
    });
    expect(packagingSelectionTotals(options, ['wrap'])).toEqual({
      selectedCount: 1,
      unitsPerParcel: 2,
    });
  });

  it('treats a missing per-parcel rate as one unit when selected', () => {
    expect(packagingSelectionTotals(options, ['label'])).toEqual({
      selectedCount: 1,
      unitsPerParcel: 1,
    });
  });

  it('reports an explicit empty selection (consume no packaging)', () => {
    expect(packagingSelectionTotals(options, [])).toEqual({
      selectedCount: 0,
      unitsPerParcel: 0,
    });
  });
});
