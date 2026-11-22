# Customer CSV import: birthdays, tags and honest counts

ARGUS #318. Any Birthday value that was not parseable became `null` with no row
error (despite the `YYYY-MM-DD` instruction), the result's "Imported" count was
the number of validated rows rather than rows actually inserted, and imported
tags kept their original case so `vip` was invisible to the `VIP` filter.

## Contract

`src/lib/services/customerImport.core.ts`:

- `parseCustomerBirthday` accepts only a real `YYYY-MM-DD` calendar date
  between 1900 and today. The row schema uses `isInvalidCustomerBirthday`, so a
  bad cell becomes a row error (`Birthday must be a real date in YYYY-MM-DD
  format`) instead of a silent null.
- `normalizeImportTags` trims, upper-cases and de-duplicates tags with the same
  `canonicalCustomerTag` helper the VIP/wholesale filters use.
- `reconcileImportCounts` reports `createMany().count` as **Imported** and the
  shortfall as **Skipped**, with a note. The route's duplicate pre-check now
  includes archived customers (they still hold the tenant-unique phone), and
  names an archived holder in the skip detail.

The audit row records the reconciled counts, not the validated row count.

## Verification

- `src/lib/services/__tests__/customerImport.core.test.ts`
- `src/lib/validators/__tests__/customer-import.validators.test.ts`
- `npx tsc --noEmit`
