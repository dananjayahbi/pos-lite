# Customers: presentation and accessibility

ARGUS #319. The list's View/Edit actions were icon-only with no accessible
name, the custom tag input had no label, detail dates used month-first
`Nov 14, 2026` and broadcast history used `9/17/2026, 4:32:17 PM`, the list
showed `22d ago` where the detail showed `3 weeks ago` for the same date,
Preferred Categories amounts were after-discount line totals with no
qualifier, and phone values mixed `+94...`, `077...` and legacy `088...`.

## Contract

- Icon buttons carry `aria-label`/`title` (`View <name>`, `Edit <name>`) and the
  icons are `aria-hidden`.
- The custom tag input has `<Label htmlFor="customer-tag-input">` plus the id.
- All customer dates use the shared day-first helper: `formatShortDate` on the
  detail page and `formatShortDateTime` in broadcast history.
- Both the list and the detail use `formatRelativeDate` from `@/lib/format`, so
  the same instant reads the same way.
- Preferred Categories carries the note "Amounts are line totals after
  discount, before tax."
- `formatCustomerPhone` renders `+94 77 123 4567` for `+94`, `0` and legacy
  `0`-prefixed values, leaving unrecognizable input untouched.

## Verification

- `src/lib/services/__tests__/customerDisplay.core.test.ts`
- `npx tsc --noEmit`
