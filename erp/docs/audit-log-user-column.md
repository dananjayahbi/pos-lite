# Audit Log — User column

The audit log table at `/settings/audit-log` shows who performed each action
without exposing raw database identifiers as the primary label.

## Table columns

| Column | Notes |
| --- | --- |
| Entity Type | Badge for the affected entity |
| Action | Humanized audit action |
| User | Resolved actor email, or `System` for automated work |
| Entity ID | Mono id, full value on hover (ARGUS #457) |
| Date | Local date/time with seconds and timezone |

The `Performed By` column was removed; the `User` column carries the resolved
name and (since ARGUS #457) the actor role beneath it. Entity ID is back in the
table for investigation, and the raw `actorId` is still returned by the API for
filtering and integrations.

## Resolution rules

`GET /api/audit-logs` now decorates every row with `actorName`:

1. `actorId == null` → `System` (cron jobs, webhooks, auth events without an
   actor).
2. Known user → the user's email address.
3. Deleted/unknown user id → `Unknown user` (never a bare CUID).

CSV export adds an `actorName` column next to `actorId`, so exports show the
same friendly label. The `?userId=` filter still filters by actor id.

Implementation: `attachAuditActorNames()` in
`src/lib/services/audit.service.ts`.
