# Promotion and customer-pricing window boundaries

ARGUS #327. The Start/End Date controls submit a bare `YYYY-MM-DD`. Parsing
that with `new Date(...)` treats it as UTC midnight, so in a UTC+05:30 store a
window began at 05:30, ended at 05:30 on the end date, and a same-day window
was empty.

## Contract

`src/lib/services/promotionWindow.core.ts` converts request bounds:

| Input | Stored instant |
| --- | --- |
| date-only `start` | `00:00:00.000` **local** on that day |
| date-only `end` | `23:59:59.999` **local** on that day |
| explicit ISO datetime | that exact instant |
| `''` / `null` | no bound (NULL) |

Date-only bounds are therefore inclusive local days. A same-day window
(`start = end = 2026-10-29`) spans local midnight to local 23:59:59.999 and is
valid. An explicit datetime end is not snapped to the end of the day.

The server process timezone is the store timezone (the deployment sets
`TZ=Asia/Colombo` for Sri Lankan stores). If the process timezone changes, the
local-day boundary moves with it.

## Validation

`windowIssues()` is shared by:

- `CreatePromotionSchema` / `UpdatePromotionSchema`
  (`src/lib/validators/promotion.validators.ts`);
- `CreateCustomerPricingRuleSchema` / `UpdateCustomerPricingRuleSchema`;
- `createPromotion` / `updatePromotion` in the service layer (effective row,
  so a PATCH that only moves the end date is checked against the stored
  start).

Rules:

- malformed dates -> `400 VALIDATION_ERROR` naming `startsAt` / `endsAt`;
- end before start -> `400 VALIDATION_ERROR` on `endsAt`;
- a zero-length explicit datetime window is rejected;
- same-day date-only windows are accepted.

The promotion form shows the field error under the date inputs.
`POST/PATCH /api/store/customer-pricing-rules` uses `toWindowDate` so customer
pricing stores the same inclusive local-day instants.

## Verification

- `src/lib/services/__tests__/promotionWindow.core.test.ts`
- `src/lib/validators/__tests__/promotion.validators.test.ts`
- `src/lib/validators/__tests__/customer-pricing.validators.test.ts`
