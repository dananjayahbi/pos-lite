import { describe, expect, it } from 'vitest';

import { ordersListState } from '@/components/orders/listState';

describe('ordersListState', () => {
  it('reports loading before the first response', () => {
    expect(ordersListState({ isLoading: true, isError: false, itemCount: 0 })).toBe('loading');
  });

  it('reports an error even when stale rows are still cached', () => {
    expect(ordersListState({ isLoading: false, isError: true, itemCount: 3 })).toBe('error');
  });

  it('reports an error rather than the empty state for a failed query', () => {
    expect(ordersListState({ isLoading: false, isError: true, itemCount: 0 })).toBe('error');
  });

  it('reports the genuine empty state only after a successful response', () => {
    expect(ordersListState({ isLoading: false, isError: false, itemCount: 0 })).toBe('empty');
  });

  it('reports ready when rows are present', () => {
    expect(ordersListState({ isLoading: false, isError: false, itemCount: 5 })).toBe('ready');
  });
});
