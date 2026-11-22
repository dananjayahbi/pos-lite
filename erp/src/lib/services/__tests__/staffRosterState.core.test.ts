import { describe, expect, it } from 'vitest';

import { resolveStaffRosterState } from '@/lib/services/staffRosterState.core';

/** ARGUS #462: a failed request must never look like zero staff. */
describe('resolveStaffRosterState', () => {
  it('is loading while the first request is pending', () => {
    expect(resolveStaffRosterState({ isLoading: true, isError: false, rowCount: 0 })).toBe(
      'loading',
    );
  });

  it('is ready when rows exist', () => {
    expect(resolveStaffRosterState({ isLoading: false, isError: false, rowCount: 3 })).toBe(
      'ready',
    );
  });

  it('is empty only for a successful response with no rows', () => {
    expect(resolveStaffRosterState({ isLoading: false, isError: false, rowCount: 0 })).toBe(
      'empty',
    );
  });

  it('lets error win over empty', () => {
    expect(resolveStaffRosterState({ isLoading: false, isError: true, rowCount: 0 })).toBe(
      'error',
    );
  });

  it('lets error win over rows/stale data', () => {
    expect(resolveStaffRosterState({ isLoading: false, isError: true, rowCount: 5 })).toBe(
      'error',
    );
  });
});
