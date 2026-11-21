/** Saved reports list state (ARGUS #447). Error must beat the empty invitation. */
export type SavedReportsListMode = 'loading' | 'error' | 'empty' | 'ready';

export function savedReportsListMode(input: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): SavedReportsListMode {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.count === 0 ? 'empty' : 'ready';
}
