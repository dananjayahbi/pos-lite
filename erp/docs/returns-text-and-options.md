# Returns text and options (ARGUS #105)

Three drift points on the returns surfaces:

## Dates

The returns history table and the return detail modal kept private formatters
(`17 Sept 2026 20:45` with a space). They now call the shared
`formatShortDateTime` from `src/lib/format.ts`, the same helper as the sales
list/modal/detail page: `17 Sept 2026, 20:45` (day-first, 24-hour, comma).

## Exchange method

The standalone **Process Return** sheet offered Cash, Card Reversal and Store
Credit, while the POS return wizard also offered Exchange. The sheet now shows
**Exchange** as a fourth method:

- it is refundable on every tender (same rule as the wizard);
- on success the refund amount is loaded into the cart store as exchange credit
  (`setExchangeCredit`), and the operator is told to complete the replacement
  sale in the POS;
- choosing Exchange hides the return-receipt path, matching the wizard.

## Short-reference lookup

The returns ledger's **Sale Ref** filter resolves printed 8-character
references server-side. A too-short, unknown or ambiguous reference used to
replace the table with one generic error line. The message now appears inline,
next to the input (`role="alert"`), with `aria-invalid`/`aria-describedby`; the
table area shows a short "fix the reference" hint instead of a second error.
The Process Return sheet's lookup message already sits under its input and now
also exposes `role="alert"`.

## Verification

UI-only changes. `npx tsc --noEmit` plus
`src/components/returns/__tests__/refundPreview.test.ts`,
`returnAuthorizer.test.ts` and `src/lib/__tests__/format.test.ts`.
