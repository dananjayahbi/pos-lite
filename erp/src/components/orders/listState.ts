/**
 * ARGUS #267 - a failed (for example 403) list request used to fall through to
 * the genuine "No orders found." empty state, leaving the operator with no way
 * to retry. The error state must win over an empty/stale row list.
 */
export type OrdersListState = 'loading' | 'error' | 'empty' | 'ready';

export function ordersListState(input: {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}): OrdersListState {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.itemCount === 0 ? 'empty' : 'ready';
}
