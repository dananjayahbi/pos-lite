# Long-open shift warning (ARGUS #115)

A shift is reconciled only when it closes. A shift left open for days therefore
leaves an uncounted drawer, and until now the only signals were the POS elapsed
clock and the opened date.

## Policy

`src/lib/shifts/shift-age.ts` owns `LONG_OPEN_SHIFT_HOURS = 12` and
`isLongOpenShift()` / `longShiftWarning()`. There is intentionally **no
auto-close** — closing writes a cash count that nobody performed.

A shift is long once `openedAt` is at least 12 hours old (a negative/skewed
timestamp is treated as 0h, never as long).

## Where it is surfaced

- **POS toolbar:** the clock reads `cashier • elapsed`, followed by an amber
  `Long shift (127h) - close to reconcile` pill with `role="status"` and a title
  carrying the full warning.
- **`/staff/shifts` ledger:** a page-level `role="alert"` banner names every long
  open shift (cashier, opened time, hours open) and says the drawer is not
  reconciled until it is closed. The matching row's **Opened** cell also carries
  a `Long shift` badge with the full warning as its title.

Both surfaces use the same helper, so the threshold cannot drift.

## Verification

`src/lib/shifts/__tests__/shift-age.test.ts` covers the 127h case, the exact
threshold, normal/short shifts, clock skew, invalid timestamps and a custom
threshold.
