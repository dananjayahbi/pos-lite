# Stock valuation — pre-tax vs till value (ARGUS #145)

Retail prices on product variants are **pre-tax**. The valuation page therefore
shows two figures:

- **Retail excl. tax** — `stockQuantity × retailPrice`, labelled “Excluding Tax”.
- **Till value incl. tax** — the same lines plus VAT (for `STANDARD_VAT`
  products) or SSCL (for `SSCL` products); `EXEMPT` lines add nothing.

Tax is computed per line with the tenant’s VAT/SSCL settings, rounded to cents,
and the VAT and SSCL amounts are shown separately. The category table and CSV
export carry the same three columns (excl. tax, tax, incl. tax), and margin
percentages use two-decimal precision.

The calculation lives in `src/lib/pricing/valuation-tax.core.ts` so the API,
page and CSV cannot disagree. Cost values and the raw-material split are
unchanged.
