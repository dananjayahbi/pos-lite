# M34-01 — BUG-78: free-form `reportType` builds the saved-report "Open" link — protocol-relative values navigate off-site

**Severity:** P2-Major (persisted open-redirect inside an authenticated surface) · **Module:** 34 Reports · **QA pin:** `tests/34_reports_analytics.spec.ts` X7 · **Depends on:** nothing

## Verified source state (2026-09-15) — holds
- `src/app/api/reports/saved/route.ts:16` — `reportType: z.string().min(1)` — **no allowlist**; arbitrary strings stored verbatim (line 156 writes it straight to Prisma). QA created `reportType:"//evil.com"` → 201.
- `src/app/(store)/reports/saved/page.tsx:30-46` `buildSavedReportHref` — line 31: `reportType.startsWith('/') ? reportType : '/reports/' + reportType` → `//evil.com/x` passes the `startsWith('/')` test and becomes a **protocol-relative href**, rendered raw at line 160 (`<a href=…>Open in App</a>`). One click navigates off-site; the payload persists until deleted.

## Fix approach
1. **Server allowlist:** `reportType: z.enum([...12 known report slugs])` (sales, revenue-trend, sales-by-staff, staff-performance, return-rate, customer-analytics, profit-loss, inventory-valuation, stock-movements, zero-value-sales, recovery-staff-performance, saved) — unknown → 400. Store the slug, not a path.
2. **Client defense-in-depth:** `buildSavedReportHref` always composes `/reports/${encodeURIComponent(slug)}` — remove the `startsWith('/')` passthrough entirely (even with the allowlist, the href builder must never trust stored strings).
3. Migration: existing rows with non-allowlisted reportType → surface as "unknown report" (disabled Open button) rather than crash; no forced rewrite needed (QA-created rows only).

## Files
- `api/reports/saved/route.ts` (schema), `reports/saved/page.tsx` (href builder), shared report-slugs constant.

## Acceptance / gate
- X7 flips: `reportType:"//evil.com"` → 400; valid slug → 201 and Open stays same-origin; CRUD/validation suite green.
