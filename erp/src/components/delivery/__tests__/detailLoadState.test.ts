import { describe, expect, it } from 'vitest';

import { deliveryDetailViewState } from '@/components/delivery/detailLoadState';

describe('deliveryDetailViewState', () => {
  it('shows loading while the request is in flight', () => {
    expect(
      deliveryDetailViewState({
        isLoading: true,
        isError: false,
        errorStatus: null,
        hasDelivery: false,
      }),
    ).toBe('loading');
  });

  it('shows not-found for a 404, not a retryable error', () => {
    expect(
      deliveryDetailViewState({
        isLoading: false,
        isError: true,
        errorStatus: 404,
        hasDelivery: false,
      }),
    ).toBe('not-found');
  });

  it('shows a retryable error for 403 and 500', () => {
    for (const status of [403, 500]) {
      expect(
        deliveryDetailViewState({
          isLoading: false,
          isError: true,
          errorStatus: status,
          hasDelivery: false,
        }),
      ).toBe('error');
    }
  });

  it('shows a retryable error for network failures with no status', () => {
    expect(
      deliveryDetailViewState({
        isLoading: false,
        isError: true,
        errorStatus: null,
        hasDelivery: false,
      }),
    ).toBe('error');
  });

  it('shows not-found when a successful response has no delivery', () => {
    expect(
      deliveryDetailViewState({
        isLoading: false,
        isError: false,
        errorStatus: null,
        hasDelivery: false,
      }),
    ).toBe('not-found');
  });

  it('shows content when the delivery loaded', () => {
    expect(
      deliveryDetailViewState({
        isLoading: false,
        isError: false,
        errorStatus: null,
        hasDelivery: true,
      }),
    ).toBe('ready');
  });
});
