/**
 * ARGUS #289 — rate-card load state.
 *
 * A failed GET must never fall through to an editable blank form: the page
 * needs an explicit loading/error/not-found/ready decision, and Save is only
 * enabled in the last two (with not-found treated as a deliberate create).
 *
 * The API returns `200 { data: null }` for an unconfigured tenant (it does not
 * 404), so any rejected/404 response is a real load failure, not "no card".
 */
export type RateCardLoadState = 'loading' | 'error' | 'not-found' | 'ready';

export function rateCardLoadState(input: {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
}): RateCardLoadState {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  if (input.data === null || input.data === undefined) return 'not-found';
  return 'ready';
}
