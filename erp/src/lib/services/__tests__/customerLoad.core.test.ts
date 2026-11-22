import { describe, expect, it } from 'vitest';

import {
  CustomerLoadError,
  customerErrorStatus,
  resolveCustomerDetailState,
  resolveCustomerListState,
} from '@/lib/services/customerLoad.core';

/**
 * ARGUS #313: the list showed an empty table on a 500 and the detail showed
 * "Customer not found" for 403/500 as well as 404. Error states must be
 * explicit, retryable, and distinct from a successful empty result.
 */
describe('resolveCustomerListState', () => {
  it('reports loading before the first response', () => {
    expect(
      resolveCustomerListState({ isLoading: true, isError: false, customerCount: 0 }),
    ).toBe('loading');
  });

  it('reports an error rather than the empty state for a failed request', () => {
    expect(
      resolveCustomerListState({ isLoading: false, isError: true, customerCount: 0 }),
    ).toBe('error');
  });

  it('reports an error even when stale rows are still cached', () => {
    expect(
      resolveCustomerListState({ isLoading: false, isError: true, customerCount: 12 }),
    ).toBe('error');
  });

  it('reports the genuine empty state only after a successful response', () => {
    expect(
      resolveCustomerListState({ isLoading: false, isError: false, customerCount: 0 }),
    ).toBe('empty');
  });

  it('reports ready when rows are present', () => {
    expect(
      resolveCustomerListState({ isLoading: false, isError: false, customerCount: 3 }),
    ).toBe('ready');
  });
});

describe('resolveCustomerDetailState', () => {
  const base = {
    isLoading: false,
    isError: false,
    errorStatus: null,
    hasCustomer: false,
  };

  it('reports loading before the first response', () => {
    expect(resolveCustomerDetailState({ ...base, isLoading: true })).toBe('loading');
  });

  it('treats a 404 as not found', () => {
    expect(
      resolveCustomerDetailState({ ...base, isError: true, errorStatus: 404 }),
    ).toBe('not-found');
  });

  it.each([401, 403, 500, 502])(
    'treats a %i failure as a load error, not "not found"',
    (status) => {
      expect(
        resolveCustomerDetailState({ ...base, isError: true, errorStatus: status }),
      ).toBe('error');
    },
  );

  it('treats an unknown failure status as a load error', () => {
    expect(resolveCustomerDetailState({ ...base, isError: true })).toBe('error');
  });

  it('reports a successful response with a customer as ready', () => {
    expect(resolveCustomerDetailState({ ...base, hasCustomer: true })).toBe('ready');
  });

  it('does not report ready for a successful response without data', () => {
    expect(resolveCustomerDetailState(base)).toBe('not-found');
  });

  it('lets a failed refetch win over cached customer data', () => {
    expect(
      resolveCustomerDetailState({
        ...base,
        isError: true,
        errorStatus: 500,
        hasCustomer: true,
      }),
    ).toBe('error');
  });
});

describe('CustomerLoadError', () => {
  it('carries the HTTP status for the detail resolver', () => {
    const error = new CustomerLoadError('Forbidden', 403);
    expect(customerErrorStatus(error)).toBe(403);
  });

  it('returns null for an unknown error', () => {
    expect(customerErrorStatus(new Error('network'))).toBeNull();
    expect(customerErrorStatus('not an error')).toBeNull();
  });
});
