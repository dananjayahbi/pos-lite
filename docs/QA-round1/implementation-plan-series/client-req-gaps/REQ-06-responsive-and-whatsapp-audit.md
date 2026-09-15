# REQ-06 — Req 1.6: full mobile/tablet responsive audit across ERP + WhatsApp button integration

**Severity:** P3 (verified per-module; needs a consolidated pass) · **Type:** client-requirement gap (verification) · **Depends on:** INF-01 (viewport tests)

## Verified source state (2026-09-15)
- Responsiveness was **spot-verified** across modules at 390px (mobile) and 768px (tablet): Module 12 (valuation no overflow), 27 (calendar), 28 (storefront mobile+tablet), 32 (POS-tablet), 33, 34, 35 — all green. WhatsApp buttons exist in the website app (Hero/Footer components reference WhatsApp).
- **Not yet done:** a single systematic sweep of every ERP store page at both breakpoints (many pages verified individually, but no consolidated matrix), and confirmation the WhatsApp button opens the *correct* chat (req 1.6 bullet: "clickable and opens correct chat") — number source + `wa.me` link format unverified end-to-end.

## Fix approach
1. Add a `tests/responsive.spec.ts` (or extend an existing suite) iterating the main store routes at 390/768 asserting no horizontal scroll + key controls visible — cheap regression net for the whole app (the module-by-module checks stay).
2. WhatsApp button: verify the tenant's `phoneNumber`/whatsapp flows into the `wa.me/<intl-format>` href with a prefilled message; broken/missing number → button hidden or disabled (not a dead link). Check both the website app and any ERP-side customer-contact affordance.
3. Record the responsive matrix in the ROADMAP sign-off checklist.

## Acceptance / gate
- New responsive spec green across enumerated routes; WhatsApp button opens the tenant's chat with correct number (manual + href assertion). Req 1.6 bullets tickable.
