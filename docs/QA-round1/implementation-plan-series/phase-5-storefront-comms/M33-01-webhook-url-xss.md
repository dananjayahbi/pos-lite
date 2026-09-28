# M33-01 — BUG-76: webhook endpoint URL stored verbatim with HTML script tags (no sanitization)

**Severity:** P2-Major (stored markup on an authenticated settings surface) · **Module:** 33 Webhooks · **QA pin:** `tests/33_webhooks.spec.ts` X1 · **Depends on:** XC-04 (sanitization policy)

## Verified source state (2026-09-15) — holds
- `src/app/api/webhooks/endpoints/route.ts:16-20` — `createEndpointSchema.url = z.string().url().refine(u => u.startsWith('https://'))` — **scheme + syntax only**; `new URL()` happily accepts `<script>` fragments in the path, so `https://evil.example.com/<script>alert(1)</script>` passes and is stored raw (127-132).
- The list API echoes the raw string. **Mitigation today:** the admin UI renders `{ep.url}` as a React text node (`WebhooksPageClient.tsx:327`) → escaped, no execution. So this is currently an **API-hygiene defect** (same class as BUG-77/94), dangerous for any non-React consumer (email digests, third-party dashboards, future `dangerouslySetInnerHTML`).

## Fix approach
1. **Reject control markup at the schema:** after `.url()`, add a refine rejecting `<`, `>`, `"`, `'`, backticks and non-printable/whitespace-inside-URL characters (a URL should never contain them — RFC 3986 forbids `<>"` outright). 400 VALIDATION_ERROR naming `url`. This is stricter than sanitizing (no silent mutation) and is the correct contract for a URL field.
2. Re-run the QA X1 probe → 400 instead of 201.
3. Fold into the XC-04 policy so the same "reject markup in typed fields" rule lands on saved-report names (M34-02) and appointment title/notes (M27-07) consistently.

## Files
- `webhooks/endpoints/route.ts` (schema refine), shared validators helper (XC-04).

## Acceptance / gate
- X1 flips: markup-bearing URL → 400; legitimate HTTPS endpoints (with query strings, hyphens, unicode-host cases the client actually uses) still 201; existing delivery/retry/RBAC suite unchanged.
