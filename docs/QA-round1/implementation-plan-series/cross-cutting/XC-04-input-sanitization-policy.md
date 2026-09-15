# XC-04 — Input sanitization / stored-HTML policy: a single schema-level rule for markup-bearing fields

**Severity:** P2 (policy) · **Type:** cross-cutting · **Depends on:** nothing · **Members:** BUG-76 (M33-01), BUG-77 (M34-02), BUG-94 (M27-07), BUG-21/26/29 leak class (INF-02), BUG-19 strictness

## Verified source state (2026-09-15)
- **No Zod `.strict()` anywhere** (grep `strict()` across `src/` → 0 matches) — every object schema silently STRIPS unknown keys. This is the systemic root of BUG-19 (the `variants` key vanishing) and why no endpoint rejects unexpected fields.
- **Stored-HTML family:** QA found raw `<script>` persisted-and-echoed in webhook URLs (BUG-76), saved-report names (BUG-77), appointment title/notes (BUG-94), product names, movement notes, supplier/customer names, etc. All are **inert in the React UI** (React escapes; grep confirms no `dangerouslySetInnerHTML` in these components) — the risk is non-React sinks: email digests, PDF/CSV export (`generateReportFile` renders server-side HTML — M34-02 flags it), third-party dashboards, and any future innerHTML use.

## Fix approach (one policy, applied consistently)
1. **Decide the rule (recommend "reject control markup in short text/URL fields; allow rich text only where a sanitizer runs"):**
   - **URLs** (webhook, logoUrl, imageUrl, mediaUrl): reject `< > " ' ` and whitespace — a URL can't legally contain them (RFC 3986). Shared `zSafeUrl()`.
   - **Short identifiers/names** (report name, product/category/brand name, supplier/customer name): reject `< >` (and backtick) — these are never markup. Shared `zSafeShortText(max)`.
   - **Free-text** (notes, description, usageInstructions, safetyPrecautions): keep storing verbatim (React escaping is the control); **DO NOT HTML-encode on store** (would corrupt Unicode round-trips QA verified byte-exact). The rule is "escape on render, never trust on server-render."
2. **Server-render sinks** (report PDF/CSV, emails, storefront SSR): every one MUST escape interpolated values. Audit `generateReportFile` + `receipt-renderer.ts` + `email` templates during implementation — those are the real XSS sinks (unlike the React UI).
3. **Selective strictness:** do NOT blanket-`.strict()` every schema (would break clients sending benign extra fields, and QA chaos tests expect tolerant 2xx/4xx-not-500). Apply strict/alias handling only where a silent-drop caused data loss (BUG-19: product create accepts `variants` alias + rejects *other* unknown top-level keys — see M02-02).
4. Codify in `docs/input-policy.md`; add the shared helpers to `src/lib/validators/shared.ts`; CI grep guard for `dangerouslySetInnerHTML` (allowlist with justification).

## Files
- new `src/lib/validators/shared.ts` helpers, member-doc route files, report/email/receipt renderers (escaping audit), `docs/input-policy.md`.

## Acceptance / gate
- BUG-76/77/94 pins flip to 400 on markup in URL/name fields; Unicode byte-exact round-trip tests (all modules' X1) stay green (proves we didn't over-sanitize free text); a report-PDF/CSV fixture with a `<script>` name renders escaped.
