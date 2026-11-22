# Rate card rejects duplicate, overlapping and blank zone rows

Multiple rows for the same destination were accepted, the pricing engine's
`findFirst` had no ordering, and a blank editor row saved a `null/null` entry
that silently became a universal fallback (ARGUS #294).

## Behaviour

- `validateRateZoneEntries()` now also rejects:
  - a destination that already appeared on an earlier row
    (`Another row already targets this destination`), and
  - a completely blank row with no destination and no rates.
- A deliberate all-destinations override (no district/city but with a base or
  extra-kg rate) is still valid.
- The route rejects these rows with a `validationError` before writing, and the
  editor lists the offending rows and disables **Save Zone Overrides**.
- The engine's three override lookups now use `orderBy: { id: 'asc' }`, so any
  legacy duplicates resolve deterministically instead of arbitrarily.

## Verification

`src/lib/delivery/__tests__/rateZone.core.test.ts` covers duplicates, a blank
row, a deliberate global row and distinct city rows. `tsc --noEmit` covers the
route/UI plumbing.
