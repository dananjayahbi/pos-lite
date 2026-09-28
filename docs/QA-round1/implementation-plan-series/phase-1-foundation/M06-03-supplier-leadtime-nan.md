# M06-03 — BUG-33: cleared Lead Time (days) blocks UI submit with raw "expected number, received NaN"

**Severity:** P3-Minor (cosmetic-but-blocking UX on an optional field) · **Module:** 06 Suppliers · **QA pin:** `tests/06_suppliers.spec.ts` B1 · **Depends on:** nothing (shares the empty-string-normalization idea with M05-01)

## Verified source state (2026-09-15) — still holds
- `src/components/suppliers/SupplierSheet.tsx:179` — `register('leadTimeDays', { valueAsNumber: true })` — clearing the input yields `NaN`.
- `src/lib/validators/supplier.validators.ts:16` — `leadTimeDays: z.int().min(1).max(365).optional()` — `NaN` is not `undefined`, so `.optional()` doesn't accept it; the standard-schema resolver surfaces the raw Zod message **"Invalid input: expected number, received NaN"** at `SupplierSheet.tsx:184`. Sheet stays open; no supplier created.
- API treats `leadTimeDays` as optional (DB default 7), so an empty field *should* submit as undefined → created with 7.

## Fix approach
1. **Form normalization (preferred):** `register('leadTimeDays', { valueAsNumber: true, setValueAs: v => v === '' || v === null ? undefined : Number(v) })` — empty → `undefined` → passes `.optional()` → DB default 7.
2. **Or schema:** `.transform(v => Number.isNaN(v) ? undefined : v)` before validation — but transform-after-coerce is fiddly with `z.int()`; the `setValueAs` route is cleaner and localizes the fix to the form.
3. Ensure the friendly default (7) is shown in the placeholder so clearing is understood as "use default".

## Files
- `src/components/suppliers/SupplierSheet.tsx` (and audit any other `valueAsNumber` numeric registers across sheets — same latent NaN leak class; ties to XC-01's input-coercion theme).

## Acceptance / gate
- `tests/06` B1 flips: clear Lead Time → Create → 201 with leadTimeDays 7 (not blocked by NaN message). F6 (boundary 1/365) and T2 stay green.
