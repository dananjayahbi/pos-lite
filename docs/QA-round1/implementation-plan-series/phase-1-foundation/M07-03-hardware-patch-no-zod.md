# M07-03 — OBS-82: hardware PATCH has no zod (invalid port silently → 9100; string `"false"` → `true`)

**Severity:** P3-Minor (data-integrity-adjacent coercion surprises) · **Module:** 07 Settings · **QA pins:** `tests/07` H2, N4, X6 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
`src/app/api/settings/hardware/route.ts` PATCH:
- Manual parsing — destructures `body` (line 32), hand-validates only `printerType`/`host` (34-49). **No schema.**
- Port: line 66 `typeof port === 'number' && port > 0 && port <= 65535 ? port : 9100` — any invalid/string value **silently becomes 9100** instead of 400.
- Booleans: lines 68-69 `Boolean(cashDrawerEnabled)` / `Boolean(cfdEnabled)` — `Boolean("false") === true`, so a client sending the *string* `"false"` **enables** the drawer. QA pins H2/N4/X6 assert exactly these current behaviors.

## Fix approach
1. Add `HardwareSettingsSchema` in `src/lib/validators/` (new or settings validators file): `printerType` enum, `host` string ≤255 (or empty for non-network types), `port` int 1..65535 optional, `cashDrawerEnabled`/`cfdEnabled` `z.boolean()` — reject non-boolean (no coercion), message names the field.
2. Route: `safeParse` → 400 VALIDATION_ERROR on invalid (typed envelope); remove the silent-9100 fallback (validity is now the contract).
3. Tax-rates route accepts numeric strings via `Number()` (QA P3 pin) — decide once: allow numeric strings for form compatibility OR strict types. Recommend strict booleans (dangerous semantic flips) but tolerant numeric strings for rates (benign), and record the asymmetry rationale in the PR.

## Files
- `src/lib/validators/settings.validators.ts` (new schema), `src/app/api/settings/hardware/route.ts`.

## Acceptance / gate
- `tests/07` H2/N4/X6 flip: `"false"` → 400; `port:"9100"` → 400 (not silent 9100); valid payloads persist unchanged. Taxes P3 pin decision recorded.
