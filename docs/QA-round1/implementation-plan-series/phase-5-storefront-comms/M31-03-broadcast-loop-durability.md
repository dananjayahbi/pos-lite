# M31-03 — OBS-53/54: broadcast runs a sequential N×1s send loop inside the request (audit lost on timeout); cron secret comparison inconsistent

**Severity:** P2-Major (scalability + durability of the broadcast record) · **Module:** 31 Communications · **QA ref:** OBS-53 (route's own NOTE at `:8-10`), OBS-54 · **Depends on:** M31-01 (provider), INF-03

## Verified source state (2026-09-15) — holds
- `src/app/api/broadcast/whatsapp/route.ts`: sequential `for` loop over recipients (121-141), `await` each send, `setTimeout(...,1000)` between (137-139); the `CustomerBroadcast` row is created **after the loop completes** (144-158). A full-audience broadcast (423 phone-bearing customers) ≈ 7+ minutes inside one request → serverless/edge timeout kills it AND destroys the audit record entirely (the file's own NOTE acknowledges this).
- **OBS-54:** `cron/birthday-greetings` compares bearer token with plain `===` while sibling `birthday-messages` uses `timingSafeEqual` — both fail closed correctly (QA N-series), but hygiene is inconsistent across sibling routes.

## Fix approach
1. **Record-first, send-later:** create the `CustomerBroadcast` row (status `SENDING`, recipient snapshot) BEFORE dispatching, then send in a background continuation:
   - Minimal (Vercel-friendly): `waitUntil`-style fire-and-continue after the response, chunked sends without the artificial 1s sleep (Meta's rate limits govern pacing — move any delay to provider-429 backoff), updating the row's analytics incrementally (`sentCount/failedCount` fields or a per-recipient `BroadcastRecipient` table — recommend the table: enables retry of failures + the history detail page already wants per-recipient data).
   - Proper (later): a queue/cron worker; out of scope here — the row-first change alone removes the audit-loss failure mode.
2. **Idempotency:** the POST already creates exactly one row per request (QA R-verified) — keep that once async: double-click → one SENDING row.
3. **OBS-54:** extract one `requireCronSecret(request)` helper (timingSafeEqual) in `src/lib/cron-auth.ts` (file exists) and use it in every cron route — one sweep, fixes the inconsistency class.

## Files
- `api/broadcast/whatsapp/route.ts` (restructure), optional `BroadcastRecipient` model + migration, `src/lib/cron-auth.ts` + all cron routes.

## Acceptance / gate
- `tests/31` broadcast tests stay green at record level (202, one row, analytics shape); new assertion: row exists with status SENDING/COMPLETED even when the send phase is interrupted; cron-secret helper unit test (timing-safe path).
