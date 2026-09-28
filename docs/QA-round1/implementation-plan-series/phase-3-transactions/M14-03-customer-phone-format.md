# M14-03 — Req 2.2: no phone-number **format** validation at POS customer capture (length-only)

**Severity:** P2-Major (client req 2.2 third bullet, still `[ ]`) · **Module:** 14 POS / 05 Customers · **QA refs:** `tests/05` F5 (length-only contract), `tests/14` walk-in creation · **Depends on:** nothing

## Verified source state (2026-09-15)
- `src/lib/validators/customer.validators.ts:9` — `phone: z.string().min(1,'Phone is required').max(20)` — **length only, no format**. Any string ("abc", "1", "x"*20) is a valid customer phone; walk-in POS creation inherits it.
- Contrast: the **supplier** validator already enforces the Sri Lankan pattern `^(\+94\d{9}|07\d{8})$` (QA module 06 verified a 16-case contract) — the convention exists in the codebase, just not applied to customers.
- Req 2.2 bullets: name-required ✅, phone-required ✅ (both verified in Module 14), **phone format ❌ open**.

## Fix approach
1. Add a shared `zSriLankaPhone` helper (normalize + accept `+94XXXXXXXXX` / `0XXXXXXXXX`, optional spaces/dashes stripped) in `src/lib/validators/shared.ts`; reuse for supplier (replace its inline regex) and customers.
2. **Migration risk:** existing customers may hold non-conforming phones (seeded + QA data). Options: (a) validate on create/update only (existing rows untouched — recommended), (b) data cleanup pass first. Document that `tests/05` F5's "phone 1..20" cases must be updated to the new contract (some currently-201 payloads become 400).
3. POS walk-in UI: inline format hint + block submit on malformed (matches the mandatory-customer story).
4. **Client decision:** whether foreign/international numbers must be accepted (req says local SL store → recommend SL format with an escape hatch flag).

## Files
- `src/lib/validators/shared.ts` (new helper), `customer.validators.ts`, `supplier.validators.ts` (adopt helper), walk-in customer creation route/UI, `tests/05` F5 + `tests/14` walk-in cases.

## Acceptance / gate
- New/updated assertions: malformed phone → 400 with `path:['phone']`; valid SL formats round-trip; existing-customer reads unaffected.
