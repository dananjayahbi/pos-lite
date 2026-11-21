/**
 * ARGUS #273 - a missing id and a failed/403 request must not share the same
 * "Delivery not found" screen. The error state is retryable; 404 is terminal.
 */
export type DeliveryDetailViewState = 'loading' | 'not-found' | 'error' | 'ready';

export function deliveryDetailViewState(input: {
  isLoading: boolean;
  isError: boolean;
  errorStatus: number | null;
  hasDelivery: boolean;
}): DeliveryDetailViewState {
  if (input.isLoading) return 'loading';
  if (input.isError) {
    return input.errorStatus === 404 ? 'not-found' : 'error';
  }
  return input.hasDelivery ? 'ready' : 'not-found';
}
