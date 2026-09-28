# M05-02 — BUG-26 + BUG-29: birthday `""`/invalid string → 409 with raw Prisma internals and a *wrong* "already exists" message

**Severity:** P1-Critical (breaks customer creation through the UI for the common no-birthday case, with a misleading error) · **Module:** 05 Customers · **QA pins:** `tests/05_customers.spec.ts` B2, T1 · **Depends on:** INF-02 (leak half), M05-01 (same form/schema file — sequence together)

## Verified source state (2026-09-15) — both still hold
- `src/components/customers/CustomerSheet.tsx` always includes `birthday: ''` when the date input is untouched → POST body `birthday:""`.
- `src/lib/services/customer.service.ts:45` (create) and `:92` (update): `...(data.birthday !== undefined && { birthday: new Date(data.birthday) })` — **no empty-string guard** → `new Date('')` = Invalid Date → Prisma rejects.
- `src/lib/validators/customer.validators.ts:12` — `birthday: z.string().optional()` — plain string, no date validation (BUG-29: `"not-a-date"` sails through Zod).
- `src/app/api/store/customers/route.ts:103` POST catch: `message.includes('already exists')` matches the Prisma dump (which echoes a source line containing that text) → **409 CONFLICT "A customer with this phone number already exists"** — completely wrong message — plus raw internals leak (server paths, chunk names).

## Fix approach (three layers, each independently sufficient for a subset)
1. **Validator (primary):** `birthday: z.union([z.literal(''), z.string().datetime(...)/coerce date refine]).optional().transform('' → undefined)` — reject unparseable non-empty strings with 400 VALIDATION_ERROR (fixes BUG-29 at the boundary); empty → undefined (fixes BUG-26).
2. **Service guard:** `customer.service.ts` — only pass `birthday` when the parsed value is a valid date (defensive, covers PATCH path `:92`).
3. **Error mapping:** route catch goes through INF-02's `map-prisma-error` so no Prisma dump can ever surface as a 409 message (kills the leak + the wrong-message class for this file, shared with M04-01/M08-05).

## Files
- `src/lib/validators/customer.validators.ts`, `src/lib/services/customer.service.ts`, `src/app/api/store/customers/route.ts` (+ `[id]` PATCH), `CustomerSheet.tsx` only if the date input keeps a `''` default (prefer schema normalization, no UI change).

## Acceptance / gate
- `tests/05` B2 flips: UI create without birthday → 201, detail correct. T1 flips: `birthday:"not-a-date"` → 400 VALIDATION_ERROR (not 409, no internals). F2/F3 (round-trip, dup-phone 409) stay green — the phone-dup 409 must still be the *friendly* message.
