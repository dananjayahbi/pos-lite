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

## Verification

`src/lib/notifications/__tests__/notification-time.test.ts` pins the relative
labels, the day-first old-row date, and the invalid-date fallback.
