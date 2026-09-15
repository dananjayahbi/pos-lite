# M05-01 — BUG-25: empty optional Email field blocks UI customer creation ("Invalid email address")

**Severity:** P2-Major (blocks a primary CRM workflow; walk-in customers legitimately have no email) · **Module:** 05 Customers · **QA pin:** `tests/05_customers.spec.ts` B1 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/lib/validators/customer.validators.ts:10` — `email: z.string().email().max(100).optional()` — correctly optional at the **API** (probe: POST without email → 201).
- `src/components/customers/CustomerSheet.tsx:72` — resolver `standardSchemaResolver(CreateCustomerSchema)`; email input `register('email')` at `:207`. An untouched input submits `''`; `z.string().email()` **rejects `''`** (only `undefined` passes `.optional()`).
- Result: Add Customer with Name + Phone but no Email → sheet stays open, "Invalid email address" under an optional (no-`*`) field. Users are told nothing about the workaround.

## Fix approach (pick one, prefer schema-level so API + UI agree)
1. **Schema:** `email: z.union([z.literal(''), z.string().email().max(100)]).transform(v => v === '' ? undefined : v)` — empty string accepted client-side and normalized to undefined before the POST. (Or `z.string().trim().toLowerCase().optional().refine(…)` — equivalent; document choice.)
2. **Alternative (sheet-level):** `register('email', { setValueAs: v => v === '' ? undefined : v })` — keeps the schema strict but fixes only this form; other forms with the same pattern (supplier email/whatsapp/address — QA noted supplier fields accept `""` deliberately) would each re-fix it. Prefer the schema.
3. Apply the same normalization to `notes`/`address`-style optional strings only where they're already accepted as `''` by the API (don't change working semantics — Customer `notes:''` → 201 already passes, verified by QA F2 round-trips).

## Files
- `src/lib/validators/customer.validators.ts` (+ Vitest), or `CustomerSheet.tsx` if the form-level route is chosen.

## Acceptance / gate
- `tests/05` B1 flips: create via UI with Email empty → row appears, toast "Customer created".
- F2 (API round-trip) and F5 (validation contract: *malformed* email still 400) stay green — an invalid non-empty email must still be rejected.
