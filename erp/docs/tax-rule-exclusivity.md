# VAT and SSCL are mutually exclusive

A product carries one `TaxRule`, and the engine resolves exactly one percentage
from it. VAT and SSCL do not stack. The Tax settings screen listed both
percentages side by side, which read as "18% + 2.5%" and made a Rs 1,065 sale
look like it should be charged 218.33 instead of 191.70 (ARGUS #469).

## Contract

`resolveTaxRate(rule, rates)` in `src/lib/pricing/taxRules.core.ts`:

| Product tax rule | Rate applied          | Rs 1,065 sale |
| ---------------- | --------------------- | ------------- |
| `STANDARD_VAT`   | tenant `vatRate` only | 191.70 at 18% |
| `SSCL`           | tenant `ssclRate` only| 26.63 at 2.5% |
| `EXEMPT`         | 0                     | 0.00          |

A missing or unknown rule falls back to `STANDARD_VAT`, preserving the legacy
cart items that predate the field (ARGUS #60). There is no combined
VAT+SSCL rule and none was invented: the schema has one enum per product, so a
combined class would need a new rule value plus a migration.

Both the server (`createSale`) and the POS cart preview call this same helper,
so a preview can never apply a different rule set from the saved sale.

## Settings copy

`taxRulePreviewRows(rates)` returns the three rows the Tax settings screen
renders. They are labelled "Standard VAT (VAT only)", "SSCL (SSCL only)" and
"VAT Exempt", the card says the percentages are alternatives, and there is no
combined row. The preview still uses the live values being edited, so the owner
sees the rate that will be saved.

## Verification

`src/lib/pricing/__tests__/taxRules.core.test.ts` is an exclusivity matrix:
each rule maps to one rate, 18% and 2.5% are never added, the reported Rs 1,065
sale is 191.70 (not 218.33), SSCL is 26.63, EXEMPT is 0, and the fallback and
preview rows are covered. The existing cart-tax and management-sale parity
tests still pass against the shared resolver.
