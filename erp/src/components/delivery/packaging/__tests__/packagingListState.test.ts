import { describe, expect, it } from 'vitest';

import { resolvePackagingListState } from '@/components/delivery/packaging/packagingListState';

/** ARGUS #284: a failed load is an error, never the empty state. */
describe('resolvePackagingListState', () => {
  it('is loading while the first request is in flight', () => {
    expect(resolvePackagingListState({ isLoading: true, isError: false, itemCount: 0 })).toBe(
      'loading',
    );
  });

  it('is an error even when stale rows are still cached', () => {
    expect(resolvePackagingListState({ isLoading: false, isError: true, itemCount: 3 })).toBe(
      'error',
    );
  });

  it('is empty only after a successful zero-row response', () => {
    expect(resolvePackagingListState({ isLoading: false, isError: false, itemCount: 0 })).toBe(
      'empty',
    );
  });

  it('is ready when rows loaded', () => {
    expect(resolvePackagingListState({ isLoading: false, isError: false, itemCount: 2 })).toBe(
      'ready',
    );
  });
});
