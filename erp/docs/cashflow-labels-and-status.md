# Cash Flow labels, account status and bar scaling (ARGUS #423)

- The top card and the Income section total both read **Net Cash Income**, so the
  same `totalIncome` figure carries one name.
- Payment methods use the shared `paymentMethodLabel()` map
  (`LANKAQR` → LankaQR, `CARD_REVERSAL` → Card Reversal, unknown enums are
  title-cased).
- Expense categories use `expenseCategoryLabel()`: `TEA_SUGAR` → `Tea sugar`
  instead of `Tea_sugar`; uppercase enums are sentence-cased.
- Payment Account Activity has a **Status** badge column (Active / Closed).
  Closed accounts keep their in-window flows in the table because those entries
  happened, but remain excluded from the active balance total; the footnote says
  so.
- Expense bars are scaled to **total** expenses, not the largest category, and
  each row prints its share (Salaries at 68.3% fills 68.3%). The total row shows
  100.0% when there are expenses.
- Pure helpers (`accountTypeLabel`, `accountStatusLabel`, `shareOfTotalPercent`)
  live in `src/lib/reports/labels.ts` and are covered by `labels.test.ts`.
