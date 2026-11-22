/**
 * Packaging Stock list state (ARGUS #284).
 *
 * A failed GET used to fall through to the empty state ("No packaging items"),
 * hiding the failure and offering no retry. Mirrors the shared rate-card
 * loading/error pattern: error wins even if stale rows are cached.
 */
export type PackagingListState = 'loading' | 'error' | 'empty' | 'ready';

export function resolvePackagingListState(input: {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}): PackagingListState {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.itemCount <= 0 ? 'empty' : 'ready';
}
