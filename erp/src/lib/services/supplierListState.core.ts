/**
 * List state for the suppliers table (ARGUS #234).
 *
 * The table used to derive "No suppliers found" from `suppliers.length === 0`.
 * A failed request also produced an empty array (React Query data is undefined,
 * the fallback is `[]`), so a 500 rendered the genuine empty state with no
 * error and no retry. The state is explicit here:
 *
 * - `loading` wins over everything while the first fetch is in flight;
 * - `error` covers both a rejected query and a parsed `{ success:false }`
 *   envelope, whose data would otherwise look like an empty list;
 * - only a successful response with zero rows is `empty`.
 */

export type SuppliersListState = 'loading' | 'error' | 'empty' | 'ready';

export interface SuppliersListStateInput {
  isLoading: boolean;
  /** React Query's `isError` (network failure, non-2xx, thrown envelope). */
  isError: boolean;
  /** The parsed envelope's success flag, when a response body was read. */
  success?: boolean | undefined;
  count: number;
}

export function getSuppliersListState(input: SuppliersListStateInput): SuppliersListState {
  if (input.isLoading) return 'loading';
  if (input.isError || input.success === false) return 'error';
  return input.count === 0 ? 'empty' : 'ready';
}
