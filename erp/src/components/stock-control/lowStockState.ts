/**
 * ARGUS #213 — the low-stock view state.
 *
 * The page used to render its "All variants are adequately stocked" empty state
 * whenever the feed returned no rows, including when the request failed. A
 * failed check must never look like an all-clear, so the states are resolved
 * explicitly here (and unit tested) instead of being implied by `data.length`.
 */
export type LowStockViewState = 'permission' | 'error' | 'loading' | 'empty' | 'list';

export interface LowStockViewInput {
  hasPermission: boolean;
  /** The query failed (non-2xx, network error or a rejected envelope). */
  isError: boolean;
  /** First load in flight. */
  isLoading: boolean;
  /** Rows in the successful response. */
  variantCount: number;
}

export function resolveLowStockViewState(input: LowStockViewInput): LowStockViewState {
  if (!input.hasPermission) return 'permission';
  // Error outranks every data-dependent state, so a failed request can never
  // fall through to the healthy empty state.
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  if (input.variantCount === 0) return 'empty';
  return 'list';
}

/**
 * Count badge label. On error it is a neutral dash — not `0`, which would read
 * as "no low-stock variants". The badge is hidden entirely while loading.
 */
export function lowStockBadgeLabel(state: LowStockViewState, total: number): string | null {
  switch (state) {
    case 'permission':
    case 'loading':
      return null;
    case 'error':
      return '-';
    case 'empty':
      return '0';
    case 'list':
      return String(total);
  }
}

/** Human message for the error card; never empty, never leaks a stack. */
export function lowStockErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return 'The low stock feed could not be loaded.';
}
