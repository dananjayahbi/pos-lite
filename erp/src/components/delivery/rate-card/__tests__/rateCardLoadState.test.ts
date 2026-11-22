import { describe, expect, it } from 'vitest';

import { rateCardLoadState } from '@/components/delivery/rate-card/rateCardLoadState';

/**
 * ARGUS #289 — a failed GET is not an empty card.
 */
describe('rateCardLoadState', () => {
  it('is loading while the query is in flight', () => {
    expect(rateCardLoadState({ isLoading: true, isError: false, data: undefined })).toBe(
      'loading',
    );
  });

  it('is an error even when stale data is still cached', () => {
    expect(
      rateCardLoadState({ isLoading: false, isError: true, data: { name: 'stale' } }),
    ).toBe('error');
  });

  it('treats an intentional null payload as not-found', () => {
    expect(rateCardLoadState({ isLoading: false, isError: false, data: null })).toBe(
      'not-found',
    );
  });

  it('is ready only after a real card payload arrives', () => {
    expect(
      rateCardLoadState({ isLoading: false, isError: false, data: { name: 'Standard' } }),
    ).toBe('ready');
  });
});
