import { describe, expect, it } from 'vitest';

import {
  ORIGIN_NOT_SUPPORTED_MESSAGE,
  isOriginSpecificZone,
  originSpecificEntryCount,
  validateRateZoneEntries,
  withoutOriginSpecificEntries,
} from '@/lib/delivery/rateZone.core';

/** ARGUS #290: origin is not in the data model; destination ids must be real. */
describe('rate zone origin handling', () => {
  it('flags an origin-specific row instead of applying it everywhere', () => {
    expect(isOriginSpecificZone({ originDistrictId: 12, destinationCityId: 201 })).toBe(true);
    expect(originSpecificEntryCount([
      { originDistrictId: 12, destinationCityId: 201 },
      { originDistrictId: null, destinationCityId: 202 },
      { destinationCityId: 203 },
    ])).toBe(1);
  });

  it('removes origin-specific rows for the destination-only matrix', () => {
    expect(
      withoutOriginSpecificEntries([
        { id: 'legacy', originDistrictId: 12 },
        { id: 'keep', originDistrictId: null, destinationCityId: 201 },
      ]),
    ).toEqual([{ id: 'keep', originDistrictId: null, destinationCityId: 201 }]);
  });

  it('reports the explicit origin-not-supported error', () => {
    expect(validateRateZoneEntries([{ originDistrictId: 12 }])).toEqual([
      { index: 0, field: 'originDistrictId', message: ORIGIN_NOT_SUPPORTED_MESSAGE },
    ]);
  });
});

describe('validateRateZoneEntries destination existence', () => {
  const context = { districtIds: [1, 2], cityIds: [201, 202] };

  it('accepts known destination ids and a global fallback row', () => {
    expect(
      validateRateZoneEntries(
        [
          { destinationDistrictId: 1, destinationCityId: 201 },
          { destinationDistrictId: null, destinationCityId: null },
        ],
        context,
      ),
    ).toEqual([]);
  });

  it('rejects an unknown district and city with their own field paths', () => {
    expect(validateRateZoneEntries([{ destinationDistrictId: 99, destinationCityId: 999 }], context))
      .toEqual([
        {
          index: 0,
          field: 'destinationDistrictId',
          message: 'District not found in the synced courier locations.',
        },
        {
          index: 0,
          field: 'destinationCityId',
          message: 'City not found in the synced courier locations.',
        },
      ]);
  });

  it('skips existence checks when no courier master list is cached', () => {
    expect(validateRateZoneEntries([{ destinationDistrictId: 99 }], {})).toEqual([]);
  });

  it('reports the entry index for the route response', () => {
    expect(
      validateRateZoneEntries(
        [{ destinationDistrictId: 1 }, { destinationDistrictId: 99 }],
        context,
      ),
    ).toEqual([
      {
        index: 1,
        field: 'destinationDistrictId',
        message: 'District not found in the synced courier locations.',
      },
    ]);
  });
});
