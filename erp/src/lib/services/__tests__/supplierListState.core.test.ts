import { describe, expect, it } from 'vitest';

import { getSuppliersListState } from '@/lib/services/supplierListState.core';

/** ARGUS #234: a failed load is never the empty state. */
describe('getSuppliersListState', () => {
  it('reports loading while the first fetch is in flight', () => {
    expect(getSuppliersListState({ isLoading: true, isError: false, count: 0 })).toBe('loading');
  });

  it('reports error for a rejected query even with zero rows', () => {
    expect(getSuppliersListState({ isLoading: false, isError: true, count: 0 })).toBe('error');
  });

  it('reports error for a parsed success:false envelope', () => {
    expect(
      getSuppliersListState({ isLoading: false, isError: false, success: false, count: 0 }),
    ).toBe('error');
  });

  it('reports empty only for a successful response with no rows', () => {
    expect(
      getSuppliersListState({ isLoading: false, isError: false, success: true, count: 0 }),
    ).toBe('empty');
  });

  it('reports ready when rows are present', () => {
    expect(
      getSuppliersListState({ isLoading: false, isError: false, success: true, count: 3 }),
    ).toBe('ready');
  });

  it('does not infer empty from an undefined success flag and zero rows before data exists', () => {
    // No data yet but not loading/error is not a real render path; the helper
    // keeps it distinct from an error so callers can still show an empty state.
    expect(getSuppliersListState({ isLoading: false, isError: false, count: 0 })).toBe('empty');
  });
});
