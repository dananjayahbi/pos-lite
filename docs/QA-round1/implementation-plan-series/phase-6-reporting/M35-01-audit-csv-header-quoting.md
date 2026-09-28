# M35-01 — BUG-79: audit-log CSV export quotes the header row (non-idiomatic)

**Severity:** P3-Minor · **Module:** 35 Audit · **QA pin:** `tests/35_audit_health.spec.ts` F7 · **Depends on:** nothing

## Verified source state (2026-09-15) — holds
- `src/app/api/audit-logs/route.ts:54-68` — `csvRows` puts the header array (55) as the first row, then line 68 applies the SAME per-cell mapper `cell => \`"${String(cell).replace(/"/g,'""')}"\`` to **every** row including the header → `"createdAt","entityType",…`. Data cells are also all quoted regardless of need. RFC-4180-balanced (P3/X7 verified) but non-idiomatic; Excel/Sheets render literal quotes in some locales; diff tools flag it.

## Fix approach
- Special-case the header row: emit `headers.join(',')` unquoted (they're fixed ASCII identifiers with no commas/quotes). Optionally quote data cells only when they contain `,` `"` or newline (proper minimal-quoting CSV). Keep the `Content-Type: text/csv` + `Content-Disposition: attachment` (QA-verified) unchanged.
- Consider a tiny shared CSV writer in `src/lib/export.ts` (there's already an `export.ts`) so low-stock/valuation/movements/audit CSVs share one correct implementation (they currently each hand-roll quoting — QA noted low-stock uses an UNQUOTED header while audit quotes it: inconsistency across exports).

## Files
- `api/audit-logs/route.ts` (or the shared writer), sweep other CSV export routes for header-quoting parity.

## Acceptance / gate
- F7 flips: header line == `createdAt,entityType,entityId,action,actorId,actorRole,ipAddress`; data rows still parse (a cell containing a comma stays correctly quoted).
