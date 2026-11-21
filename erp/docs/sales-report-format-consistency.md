# Report currency, dates and labels (ARGUS #440)

One convention for the report surfaces:

- Money uses `formatRupee()` / `formatSignedRupee()` from `src/lib/format.ts`
  (`Rs. 28,843.23`), never an `Intl` LKR currency formatter. That is why the
  Sales and P&L pages no longer print `LKR 28,843.23`.
- Dates are day-first (`1 Sep 2026 - 30 Sep 2026`). `formatReportDateRange()`
  in `src/lib/reports/labels.ts` backs the date-range trigger, the PDF
  sub-header and saved-report metadata. Month names come from a fixed table so
  ICU changes (`Sep` vs `Sept`) cannot shift the label.
- Payment methods use `paymentMethodLabel()` (Cash, Card, LankaQR, Split, ...)
  instead of raw enums.
- Expense categories use `expenseCategoryLabel()`: `MISCELLANEOUS` →
  `Miscellaneous`, `TEA_SUGAR` → `Tea sugar`.
- The report header shows the active report title on every breakpoint, not just
  the "Reports" nav label.
- The monthly gross-profit chart shares one zero baseline: negative months hang
  below the line instead of growing upward like a gain.
