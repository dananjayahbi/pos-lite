# Tax-rule labels use the tenant rates

Product surfaces no longer hard-code a VAT percentage (ARGUS #143). They used to
say "Standard VAT (15%)" while the Tax settings screen and the sale engine
resolved the tenant's configured **18.00%** (plus SSCL 2.50%), understating tax
by three points on every product form and detail page.

## Behaviour

`taxRuleLabel(rule, rates)` in `src/lib/constants/product-options.ts` renders:

| Rule         | Example                                   |
| ------------ | ----------------------------------------- |
| STANDARD_VAT | `Standard VAT (18%)` using tenant vatRate |
| SSCL         | `SSCL (2.5%)` using tenant ssclRate       |
| EXEMPT       | `VAT Exempt`                              |

The rates come from `GET /api/settings/taxes` through the shared `useTaxRates()`
hook (same `['tax-rates']` query the POS cart uses). While the rates are still
loading the label omits the number ("Standard VAT") rather than showing a wrong
one. Rates are formatted without trailing zeros (`18`, `2.5`, `2.25`).

Applied in the product detail card, the edit sheet and the new-product wizard.
`TAX_RULE_OPTIONS` now carries neutral labels so no component re-introduces a
fixed percentage.

## Verification

`src/lib/constants/__tests__/taxLabels.test.ts` covers the tenant VAT/SSCL
labels, the not-loaded fallback, exempt/unknown rules and rate formatting.
