# Notification row formatting (ARGUS #56–#59)

The `/notifications` page and the header bell popover render the same stored
rows, so their display rules live in shared helpers rather than duplicated
component code.

## Time labels (ARGUS #56)

`src/lib/notifications/notification-time.ts` exports
`formatNotificationTime(dateStr, now?)`. Rows younger than a week keep the
short labels (`15m ago`, `Yesterday`, `3d ago`). Older rows use
`formatDisplayDate()` from `src/lib/format.ts`, which renders the app-wide
day-first style `28 Oct 2026` (en-GB), not the runtime locale's `10/28/2026`.

Both the page and the popover call this helper, so the two surfaces cannot
drift and a US-locale device no longer changes the date style.

## Money labels (ARGUS #57)

Stored bodies are historical text, so display code passes every body through
`normalizeRupeeText()` (`src/lib/format.ts`). It rewrites `Rs. 2476.58` to
`Rs. 2,476.58` and `Rs. -1156.70` to `-Rs. 1,156.70` without changing wording.
`formatSignedRupee()` uses the same grouping for the generated sale-alert copy,
so new rows are correct at write time and old rows are corrected at read time.

## Zero-value reasons (ARGUS #58)

A zero or negative total now appends the persisted reason, e.g.
`Sale #A1B2C3D4 completed for Rs. 0.00. Reason: Bank payment.` The API joins
`Sale.zeroValueReason` with the other sale fields, so historical rows get the
reason without a rewrite; new rows are written with it. Labels are
`Bank payment`, `Replacement`, and `Complimentary`; when a legacy row has no
reason the copy says `Reason: not recorded` rather than guessing.

## Distinguishable sale titles (ARGUS #59)

Completed sale alerts used the single title `Sale Completed`, so 103 rows
looked identical. `saleAlertTitle()` now renders `Sale #<reference> · <buyer>`
and falls back to the first product snapshot when the sale has no linked
customer, e.g. `Sale #ABCDEF12 · Chocolate Cake`. Summaries are whitespace
collapsed and capped at 32 characters; with neither name available the title
keeps the reference (`Sale #ABCDEF12`), and a blank id keeps the old constant.

A `Sale` row has no separate invoice-number column (invoices are a billing
concept), so the reference is the same 8-character id printed on the receipt.
The notifications API joins `customer.name` and the first line's
`productNameSnapshot`; the sale producer writes the same copy at creation.

## Verification

`src/lib/notifications/__tests__/notification-time.test.ts` pins the relative
labels, the day-first old-row date, and the invalid-date fallback.
`src/lib/__tests__/format.test.ts` pins grouped/signed money and the legacy-body
normaliser; `sale-alert-copy.test.ts` covers the generated copy.
