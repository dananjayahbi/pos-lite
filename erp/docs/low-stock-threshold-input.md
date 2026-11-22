# Low-stock threshold override input

ARGUS #216.

The override field was a controlled number input with `min={1}` whose handler
clamped every keystroke with `Math.max(1, parseInt(...) || 1)`. Backspacing
therefore snapped the field to `1`, so replacing `5` with `20` could produce
`120`. It also accepted `9_999_999_999`, which the API clamped to the int4
maximum and the table then rendered shortfalls around −2,147,483,644. Because
the UI enforced a minimum of 1, the API's out-of-stock view (`threshold=0`)
could not be requested from the screen.

- The input keeps the raw text, so it can be cleared.
- `parseLowStockOverrideInput` (shared, unit tested) accepts `0` for the
  out-of-stock view, rejects fractions/negatives, and rejects anything above
  `LOW_STOCK_OVERRIDE_MAX` (1,000,000) with an inline `role="alert"` message.
- The query is only given a threshold when parsing succeeds; Export CSV is
  disabled while the override is invalid.
- `useLowStockVariants` now sends `threshold` when it is `0` (`!== undefined`),
  not only when truthy.
- The API's `parseQueryInt` uses the same ceiling, so a direct request for a
  nonsense threshold returns `400` rather than an int4-clamped query.
