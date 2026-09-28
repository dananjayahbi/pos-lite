# REQ-02 — Req 3.6: multilingual support (Sinhala toggle, Tamil provisions) — no implementation exists

**Severity:** P2 (client req, greenfield) · **Type:** client-requirement gap · **Depends on:** nothing (but schedule after storefront work REQ-05 to share i18n) · **Refs:** Appendix A maps 3.6 → "no implementation found"

## Verified source state (2026-09-15)
- No i18n library anywhere: no `next-intl`/`i18next`/`useTranslation`/`LanguageToggle` hits across `erp/src` or `website/src` (grep zero); no `locales/`/`i18n/` dirs. Unicode *storage/rendering* is proven (Sinhala/Tamil/emoji round-trip tests across modules) but there is **no UI translation layer** — all chrome is English-only.
- Req 3.6 asks: Sinhala toggle + translations; English toggle; Tamil *provisions* (partial acceptable).

## Fix approach (scoped decision first — this is a feature project, not a bug)
1. **Scope question for the client:** does "language toggle" cover (a) the public storefront (`website/`), (b) the ERP admin UI, (c) customer communications (receipts/SMS), or all? Realistic reading of the SRS: storefront-first (customers are Sinhala/Tamil speaking; staff use English ERP). Recommend phase 1 = storefront + receipts, phase 2 = ERP optional.
2. **Stack choice:** `next-intl` (App Router native, locale routing `/[locale]/...` or per-tenant default with a toggle cookie). Both apps are Next 16 — one library, two integrations. Provision Tamil as a locale with partial dictionaries + English fallback (satisfies "provisions").
3. Content vs UI: translations cover UI strings; product content stays as-entered (the catalog already stores Sinhala names byte-exact — that's the merchant's data, not the platform's strings).
4. Language switch persisted per customer (localStorage/cookie) + tenant default in WebsiteConfig (ties to M29-03's settings surface).
5. Budget note for roadmap: this is the largest single REQ item (~150–300 strings per surface); flag as its own implementation session(s).

## Acceptance / gate
- New spec (storefront): toggle EN↔SI changes chrome strings; `si` locale routes render; Tamil fallback verified; no layout breakage at 390px with longer Sinhala strings (a11y/visual pass).
