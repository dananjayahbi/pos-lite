/**
 * ARGUS #204 - From/To relationship validation for the movement ledger.
 *
 * Both controls are independent, so `From 20 Nov` + `To 15 Nov` used to run a
 * query that could never match and render the ordinary empty state. The client
 * shows the message inline and the API rejects the same inverted range, so a
 * direct call cannot silently return zero rows either.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function movementDateRangeError(
  from: string | null | undefined,
  to: string | null | undefined,
): string | null {
  if (!from || !to) return null;
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return 'Enter valid dates';
  return from > to ? 'From must be on or before To' : null;
}
