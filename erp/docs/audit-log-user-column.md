# Audit Log — User column

The audit log table at `/settings/audit-log` shows who performed each action
without exposing raw database identifiers as the primary label.

## Table columns

| Column | Notes |
| --- | --- |
| Entity Type | Badge for the affected entity |
| Action | Humanized audit action |
| User | Resolved actor email, or `System` for automated work |
| Date | Local date/time |

The previous `Entity ID` and `Performed By` columns were removed from the
table. Entity IDs remain available in the row detail modal (click a row), and
the raw `actorId` is still returned by the API for filtering and integrations.

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
