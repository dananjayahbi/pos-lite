/**
 * ARGUS #244 — factory dashboard feed state.
 *
 * The dashboard used to derive every panel from `data?.data ?? []`, so a failed
 * alerts/stats/production request looked exactly like a genuine empty response:
 * a green "all raw materials are above their thresholds" all-clear, a dash KPI
 * with no explanation, or "No production runs recorded yet". The states are
 * resolved explicitly here (error first) so a failed fetch can never render an
 * empty/healthy panel, and the UI no longer shows last-known data as current.
 */
export type FactoryFeedViewState = 'error' | 'loading' | 'empty' | 'data';

export interface FactoryFeedStateInput {
  /** The query failed (non-2xx, network error or rejected envelope). */
  isError: boolean;
  /** First load in flight. */
  isLoading: boolean;
  /** Rows in the successful response. */
  itemCount: number;
}

export function resolveFactoryFeedState(input: FactoryFeedStateInput): FactoryFeedViewState {
  // Error outranks loading and every data-dependent state: a refetch failure
  // must not fall back to the healthy empty copy.
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  if (input.itemCount === 0) return 'empty';
  return 'data';
}

/**
 * KPI figure for the summary cards. While the stats feed is loading or failed
 * the value is a neutral dash (never 0, which would read as "none"), and only a
 * successful response may show a number.
 */
export function factoryKpiValue(
  state: FactoryFeedViewState,
  value: number | null | undefined,
): string {
  if (state !== 'data' || value == null || !Number.isFinite(value)) return '-';
  return String(value);
}

/** Human message for an error card; never empty, never leaks a stack. */
export function factoryFeedErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}
