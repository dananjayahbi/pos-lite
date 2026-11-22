# Audit-log investigation view (ARGUS #457)

The audit table used to show only Entity Type, Action, User and Date. Entity
ID, actor role, IP, before/after and the user agent required opening each row;
dates had no seconds/timezone and filter action labels used a different case
(`SALE COMPLETED` vs `Sale Completed`).

## Table

The list now shows:

| Column | Notes |
| --- | --- |
| Entity Type | Badge |
| Entity ID | Mono, truncated with full value on hover |
| Action | Shared title case (`formatAuditActionLabel`) |
| Performed By | Actor name + humanized role |
| IP | `-` when absent |
| Change | Compact `field: before → after` summary; full diff in the row detail |
| Date | `22 Nov 2026, 10:04:33 UTC` (seconds + timezone) |

The detail modal additionally shows `actorId`, `userAgent` and the before-only
(deleted) snapshot; action/role labels use the same helpers as the table and
the filter menu.

## Search, sharing and paging

- `?search=` (max 200 chars) matches entity ID, entity type, action, IP and
  user agent (case-insensitive contains) and flows through the filtered CSV
  export.
- The audit page hydrates its filters from the URL and writes changes back with
  `router.replace`, so a filtered investigation is bookmarkable/shareable.
- A page-size control offers 25 / 50 / 100 rows (default 50); changing filters
  or page size returns to page 1.

Pure helpers (`auditPresentation.core.ts`, `auditFilterState.core.ts`) and their
tests cover labels, timestamps, change summaries, URL round-tripping and
page-size clamping. Server-side tenant scoping and the
`settings:view_audit_log` permission are unchanged.
