# Reporting accuracy rules

This note records the accounting conventions every report must follow. The
reports were rechecked for cross-report consistency; these are the rules that
now drive the SQL/aggregations.

## 1. Accounting date

A sale belongs to the period of `Sale.saleDate` when set (backdated / missed
sales), otherwise `Sale.createdAt`:

```sql
COALESCE(s."saleDate", s."createdAt")
```

The same rule is applied to sale-based revenue, COGS, customer, staff and
zero-value reports. Returns have no separate accounting date, so they stay on
`Return.createdAt` — a return is recognised when it is processed.

## 2. Revenue is product revenue

Trading revenue is the goods value the customer actually paid:

```
revenue = SUM(Sale.subtotal - Sale.discountAmount)
```

- `Sale.subtotal` already includes line-item discounts.
- `Sale.discountAmount` is the cart-level discount (manual + promotions).
- Tax and delivery are pass-through amounts, not trading revenue, so they are
  excluded. This keeps P&L revenue aligned with returned goods value, which is
  stored pre-tax.

## 3. Cart discounts are allocated before product attribution

`SaleLine.lineTotalAfterDiscount` does **not** include the cart-level discount.
Product/category reports therefore allocate `Sale.discountAmount` across the
sale lines with `allocateCartDiscountShares()` — the same helper the sales API
uses before tax. Returns are restated on the same basis by applying the original
sale's paid ratio:

```
paidRatio = (subtotal - cartDiscount) / subtotal
netRefund = lineRefundAmount * paidRatio
```

## 4. Returns are netted in the period they are processed

- Profit & Loss: `netRevenue = productRevenue - refunds` and
  `netCOGS = COGS - returnedCOGS`.
- COGS uses `SaleLine.costPriceSnapshot` when present (recorded at sale time),
  falling back to the current variant cost for legacy/held-sale rows. Editing a
  variant's cost price therefore no longer rewrites historical profit.
- Monthly P&L: each month now subtracts that month's refunds and returned COGS.
  Previously the monthly chart only subtracted sales COGS, so months with
  returns looked more profitable than the period totals.
- Return-rate: overall and per-category rates use the same product-revenue and
  net-refund basis, so the overall rate reconciles with the category rows.

## 5. What intentionally stays gross/cash-basis

- Revenue Trend uses `Sale.totalAmount` (cash collected, including tax and
  delivery) because it charts takings, not trading margin.
- Sales-by-Staff, Staff Performance and Customer Analytics use
  `Sale.totalAmount` because they measure cash handled/spent per person.
- Inventory valuation uses current `ProductVariant.costPrice` × stock, which is
  the correct basis for a present-day stock valuation.

## Verification

- `src/lib/reports/__tests__/accounting.test.ts`
- Existing report suites: `src/lib/services/__tests__/saleDiscount.core.test.ts`
  and `tests/34_reports_analytics.spec.ts`.
