# Rate card presentation, quote preview and sane limits

The Rate Card page showed bare `475 / 100 / 0`, its toast said "Rate entries
saved" while the section was "Zone Overrides", it had no example quote, and it
accepted unbounded rates/weights - a 1,000,000 kg quote produced
Rs 100,000,475.00 (ARGUS #296).

## Behaviour

- Every zone rate input shows the formatted amount beneath it
  (`Rs. 475.00`), and the toast now says **Zone overrides saved**.
- A **Quote check** card previews the base-rate fee for a weight using
  `quoteRateCard()`, the same base + rounded-up extra-kg rule as the engine.
- Limits are shared (`MAX_RATE_WEIGHT_KG = 500`, `MAX_RATE_AMOUNT =
  1,000,000`) and enforced in the validators, the public shipping-quote route
  and the internal rate-preview route. The engine also rejects an over-limit
  weight (`RATE_WEIGHT_EXCEEDED` -> 400), so order creation cannot dodge the
  guard.
- Card versioning is not added: the data model has one active card per tenant
  and no version column, so this change does not invent a schema field.

## Verification

`src/lib/delivery/__tests__/rateCardQuote.core.test.ts` covers the arithmetic,
weight boundary and rate boundary.
