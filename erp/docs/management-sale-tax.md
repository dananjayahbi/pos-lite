# Record Sale sheet tax parity

The management **Record Sale** sheet (`NewSaleSheet`) prices a cart the same way
the API persists it. It used to add no tax at all: a 2,098.80 product showed
Total 2,098.80 and accepted 2,099 cash, while the API saved the sale at 2,476.58
with 377.78 VAT (ARGUS #74).

## Calculation

`computeManagementSaleTotals()` in
`src/lib/pricing/managementSaleTotals.ts` mirrors `createSale`:

1. Line total = `unitPrice × quantity`, less the line discount.
2. The fixed cart discount is apportioned across the lines with the shared
   `allocateCartDiscountShares` helper.
3. Each line is taxed by its product tax rule (`STANDARD_VAT` → tenant
   `vatRate`, `SSCL` → `ssclRate`, `EXEMPT` → none).
4. `total = subtotal − cart discount + tax + delivery charge`.

The sheet loads the tenant rates from `GET /api/settings/taxes` (same query the
POS cart uses) and carries each product's `taxRule` on the cart line.

## Effect on payment entry

The Tax row shows the amount (and the rate when a single rate applies). Cash
received validation, the cash placeholder, change and the SPLIT check all use
the tax-inclusive total, so the cashier collects what the server will record.
The payload still sends the raw cart discount (`cartDiscountAmount`); the API
recomputes the same tax server-side.

## Verification

`src/lib/pricing/__tests__/managementSaleTotals.test.ts` covers the ARGUS
example, discount-before-tax with mixed VAT/exempt lines, line discounts,
delivery after tax, SSCL with no configured rate, discount capping and a
tenant with no rates.
