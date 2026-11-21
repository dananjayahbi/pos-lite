import { describe, expect, it } from 'vitest';

import {
  buildRatePreviewRequest,
  resolveRatePreviewState,
} from '@/lib/delivery/ratePreview.core';

/** ARGUS #291: preview needs weight + a resolved destination, and must go stale-free. */
describe('buildRatePreviewRequest', () => {
  it('includes both the destination city and district', () => {
    expect(
      buildRatePreviewRequest({ weightKg: 2.5, destinationCityId: 201, destinationDistrictId: 12 }),
    ).toEqual({ weightKg: 2.5, destinationDistrictId: 12, destinationCityId: 201 });
  });

  it('supports a district-only preview (district override, no city)', () => {
    expect(buildRatePreviewRequest({ weightKg: 1, destinationDistrictId: 12 })).toEqual({
      weightKg: 1,
      destinationDistrictId: 12,
    });
  });

  it('requires a positive weight', () => {
    expect(buildRatePreviewRequest({ weightKg: 0, destinationCityId: 201 })).toBeNull();
    expect(buildRatePreviewRequest({ weightKg: -1, destinationCityId: 201 })).toBeNull();
    expect(buildRatePreviewRequest({ destinationCityId: 201 })).toBeNull();
  });

  it('requires a resolved city or district', () => {
    expect(buildRatePreviewRequest({ weightKg: 1 })).toBeNull();
    expect(
      buildRatePreviewRequest({ weightKg: 1, destinationCityId: 0, destinationDistrictId: -2 }),
    ).toBeNull();
  });
});

describe('resolveRatePreviewState', () => {
  const request = { weightKg: 1, destinationCityId: 201 };

  it('is incomplete until weight and location are valid', () => {
    expect(
      resolveRatePreviewState({ request: null, isPending: false, isError: false, data: undefined }),
    ).toBe('incomplete');
  });

  it('shows loading, then ready', () => {
    expect(
      resolveRatePreviewState({ request, isPending: true, isError: false, data: undefined }),
    ).toBe('loading');
    expect(
      resolveRatePreviewState({
        request,
        isPending: false,
        isError: false,
        data: { configured: true },
      }),
    ).toBe('ready');
  });

  it('surfaces a failed preview instead of keeping stale data', () => {
    expect(
      resolveRatePreviewState({
        request,
        isPending: false,
        isError: true,
        data: { configured: true },
      }),
    ).toBe('error');
  });

  it('flags a not-configured card distinctly from a genuine zero fee', () => {
    expect(
      resolveRatePreviewState({
        request,
        isPending: false,
        isError: false,
        data: { configured: false },
      }),
    ).toBe('not-configured');
    expect(
      resolveRatePreviewState({
        request,
        isPending: false,
        isError: false,
        data: { configured: true },
      }),
    ).toBe('ready');
  });
});
