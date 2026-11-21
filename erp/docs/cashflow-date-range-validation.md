# Cash Flow date-range validation (ARGUS #422)

A reversed range (`dateFrom=2030-12-31&dateTo=2024-01-01`) used to return 200
with every total at zero, which the page rendered as "No financial activity
recorded".

- `src/lib/reports/cashflowRange.ts` validates the range:
  - missing/unparseable values → `Enter valid From and To dates.`
  - rolled-over dates such as `2026-02-31` → invalid
  - `From` after `To` → `From date must be on or before the To date.`
- `GET /api/store/expenses/cash-flow` checks the resolved dates and returns
  `400 VALIDATION_ERROR` with that message.
- `GET /api/store/payment-accounts/cash-flow` applies the same check when both
  date params are present.
- The page shows the message inline (`role="alert"`) and disables **Generate
  Report** while the range is invalid, so it never issues the request.
- No arbitrary maximum range was added: annual and multi-period statements stay
  allowed, and the reversed-range bug is the reported defect.
