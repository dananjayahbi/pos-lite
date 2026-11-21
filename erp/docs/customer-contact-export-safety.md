# Ad-hoc contact export: permission, audit and CSV safety

The on-demand contact export (`GET /api/store/customers/contact-export`) was
gated on `customer:view`, returned full contact PII for the whole tenant, wrote
no audit row, and its CSV passed user-entered text straight through to
Excel/Sheets (ARGUS #316).

## Permission

The route now requires `broadcast:send`, the permission the broadcast composer
family uses for bulk contact work (`/api/customers/count`, `/preview`, sends and
history). The scheduled path is machine-authenticated with `CRON_SECRET` and
runs as `SYSTEM`, so it has no user permission to copy; for a human download the
closest equivalent is the bulk-contact key.

`customer:view` is deliberately not enough:

- it is a single-customer read that CASHIER holds by design;
- the export returns every matching customer's name, phone and email in one
  response (bulk PII), which is exactly what `broadcast:send` guards;
- the existing composer endpoints already chose this key because CASHIER also
  holds `customer:create` and `customer:view`.

A cashier calling the endpoint now receives the standard 403 envelope.

## Audit

Every successful ad-hoc download writes one `CONTACT_EXPORT_RUN` row on entity
`CUSTOMER_CONTACT_EXPORT` with:

- `actorId` and `actorRole` from the session;
- `after.trigger = 'ADHOC'`, `after.destination = 'download'`;
- `scope`, `format`, `totalCandidates`, `included` (the exported contact
  count) and `excluded`;
- an entity id suffixed with `:adhoc` so it cannot collide with a scheduled run
  created in the same millisecond.

The payload comes from `buildContactExportAuditAfter`, shared with the scheduled
run (which now records `trigger: 'SCHEDULED'`). The ad-hoc write uses the durable
`writeAuditLog`, so an audit failure fails the download instead of returning
unaudited contact data.

## CSV formula injection

`renderContactsCSV` now serialises every data cell through the existing
`csvTextCell` helper (`src/lib/export.ts`), which prefixes `'` to text beginning
with `=`, `+`, `-`, `@`, tab or CR before RFC-4180 quoting. This covers every
user-entered column:

| Column           | Example input          | CSV cell           |
| ---------------- | ---------------------- | ------------------ |
| `name`           | `=HYPERLINK(...)`      | `'=HYPERLINK(...)` |
| `phone`          | `+94712345678`         | `'+94712345678`    |
| `email`          | `@SUM(1+1)`            | `'@SUM(1+1)`       |
| `preferredStore` | `-cmd|calc`            | `'-cmd|calc`       |

Numbers (`orderCount`, `totalSpend`) pass through unchanged, so they are never
mangled by an apostrophe. The XLSX renderer writes cell values as strings, not
formula cells, so it does not execute them either.

## Verification

- `customer-contact-export.test.ts` covers the neutralisation of all four
  user-entered columns and that numeric cells stay unprefixed.
- `customer-contact-export-audit.test.ts` mocks the audit table and asserts one
  row per download with actor, role, count and trigger.
