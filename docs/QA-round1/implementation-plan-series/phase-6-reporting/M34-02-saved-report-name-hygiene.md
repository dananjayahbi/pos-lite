# M34-02 — BUG-77: saved-report name stored verbatim with HTML script tags (API hygiene; policy pending XC-04)

**Severity:** P3-Minor · **Module:** 34 Reports · **QA pin:** `tests/34_reports_analytics.spec.ts` X1 · **Depends on:** XC-04 (input-sanitization policy — implement after it decides strip-vs-reject)

## Verified source state (2026-09-15) — holds
- `api/reports/saved/route.ts:15` — `name: z.string().min(1).max(100)` — length only, no markup check. QA stored `<script>alert(1)</script>` → 201, echoed raw by the list API.
- **Inert today:** `reports/saved/page.tsx:136` renders `{report.name}` as a React text child; grep confirms no `dangerouslySetInnerHTML` in reports components. Risk is to future non-React consumers (email digests, PDF/CSV artifacts — note `generateReportFile` at route.ts:137 already renders saved reports server-side, so this is closer to exploitable than it looks: **check whether the PDF/CSV generation path HTML-escapes the name** during implementation).

## Fix approach
- Apply the XC-04 decision (recommend: reject control markup `<>"'`+backtick in short free-text name fields at the schema, same refine shared with M33-01's URL guard). One shared helper `zSafeShortText(max)`.
- **Verify `generateReportFile`** escaping for name/reportType inputs in the same pass — if it builds HTML for print/PDF, that's the real XSS sink and gets precedence.

## Files
- `api/reports/saved/route.ts` (schema), `src/lib/reports/` generator (escaping audit), shared validators helper.

## Acceptance / gate
- X1 flips to 400 on markup names; report generation artifacts (PDF/CSV) verified escaping-safe with a probe fixture.
