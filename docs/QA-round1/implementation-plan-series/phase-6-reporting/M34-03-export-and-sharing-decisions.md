# M34-03 — OBS-67/70: report export is client-side only (no server format param) and saved reports are invisible to same-tenant users

**Severity:** P2 (scope/decision) · **Module:** 34 Reports · **QA refs:** OBS-67, OBS-70 · **Depends on:** nothing (both are design decisions to confirm with the client)

## Verified source state (2026-09-15)
1. **OBS-67:** `src/lib/reports/export.ts` — `exportToCSV` (40), `exportToExcel` (57), `exportToPDF` (103) all build Blobs / `window.open`+`document.write`+`print()` in the **browser**; callers are client components (`ReportLayout.tsx:45,305`, `ZeroValueAuditClient.tsx:20,143`). Grep `get('format')` across `api/reports/**` → **zero** — no server-side `?format=csv` param. (The only server generation is `generateReportFile` at `saved/route.ts:137`, invoked at *save* time — a different path.) So scheduled/emailed reports cannot exist today.
2. **OBS-70:** `api/reports/saved/route.ts:65-71` — list filters `{ tenantId, userId: session.user.id }` → a report saved by one user is invisible to every other same-tenant user (even OWNER↔MANAGER). No share/transfer affordance.

## Fix approach (decisions, then build only if chosen)
1. **Server-side export:** if the client wants emailed/scheduled reports (implied by req 3.11's daily-summary email and any "send this report" flow), add `?format=csv|xlsx|pdf` to report routes generating server-side (reuse `generateReportFile`'s machinery, which already exists for saved reports). Recommend: expose the existing generator as a `GET /api/reports/[type]/export?format=` endpoint rather than bolting formats onto each data route. Client-side export stays for instant downloads.
2. **Saved-report sharing:** decide — (a) keep per-user privacy (current), or (b) make saved reports tenant-scoped (visible to all with `REPORT.*` permission) with a `sharedWith: 'me'|'tenant'` flag. The client asked for management reporting; (b) or a hybrid is likely what they expect. Record the choice; if (b), change the where to `{ tenantId }` + optional userId filter + a UI "Private/Team" toggle.
3. Neither is a defect — both are requirement-interpretation gaps; flag in the roadmap for the client review session.

## Files
- new export route (if 1), `api/reports/saved/route.ts` + saved page UI (if 2).

## Acceptance / gate
- Chosen behavior documented in `QA_CLIENT_REQ.md`; if server export lands, a `tests/34` case asserts a real CSV/PDF byte-stream with correct totals matching the JSON report.
