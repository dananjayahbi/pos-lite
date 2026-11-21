# Tax registration and invoice identity: current schema gap

The store stores only two tax percentages (`Tenant.settings.vatRate` and
`ssclRate`). It has no VAT/SSCL registration number, invoice prefix or invoice
sequence, and no declared inclusive/exclusive price basis (ARGUS #471). POS
receipts print one aggregate `Tax` line and no registration details.

## What the settings page now shows

The owner-only Tax settings page renders a **Tax and invoice identity** card
from `taxIdentityFieldStatus()` (`src/lib/settings/taxIdentity.core.ts`):

| Field                      | Source key (if ever present)  |
| -------------------------- | ----------------------------- |
| VAT registration number    | `vatRegistrationNumber`       |
| SSCL registration number   | `ssclRegistrationNumber`      |
| Invoice prefix             | `invoicePrefix`               |
| Next invoice number        | `invoiceNextNumber`           |

On the current schema all four read as **Not configured**. The reader will show
a value if one is already present in the settings JSON, but there is no writer,
validator or migration behind these keys; the card says so instead of implying
the values are editable. The card also states the actual price basis:
**exclusive** - product prices are entered before tax and VAT/SSCL is added at
checkout.

## Schema gap (not closable in this change)

Closing the issue properly needs a migration for one or more of:

- `Tenant.vatRegistrationNumber` / `Tenant.ssclRegistrationNumber` (or typed
  settings fields with validation), required to print a compliant tax invoice;
- an invoice prefix plus a concurrency-safe sequence allocator;
- a price-basis flag on the tenant or price list if inclusive pricing is ever
  required.

## Receipt split gap

`SaleLine` stores `lineTax` but not the applied `TaxRule`, rate, or separate VAT
and SSCL amounts. A receipt therefore cannot split the current aggregate into
VAT and SSCL without either a schema change (snapshot the rule/rate/split) or
reading the product's *current* rule, which would make old receipts change when
a product is edited. Neither is acceptable here, so the receipt keeps one
aggregate `Tax` line and the limitation is documented for the settings owner.

## Verification

`src/lib/settings/__tests__/taxIdentity.core.test.ts` covers the empty schema,
blank/malformed values, a fully populated blob, partial configuration and the
stable field order. No schema, migration or package file was changed.
