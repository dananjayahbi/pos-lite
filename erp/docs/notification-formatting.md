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

## Verification

`src/lib/notifications/__tests__/notification-time.test.ts` pins the relative
labels, the day-first old-row date, and the invalid-date fallback.
`src/lib/__tests__/format.test.ts` pins grouped/signed money and the legacy-body
normaliser; `sale-alert-copy.test.ts` covers the generated copy.
