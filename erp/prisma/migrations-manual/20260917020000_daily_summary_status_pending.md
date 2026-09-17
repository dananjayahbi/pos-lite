# M35-02 (OBS-73) — daily-summary ledger status semantics

**No DDL required.** `daily_summary_logs.status` is already a `String`, so the
new `PENDING` value needs no type change and no migration.

## What changed

`src/app/api/cron/daily-summary/route.ts` previously wrote `status: 'SENT'`
unconditionally after a `console.log` — the email was never sent, so the ledger
claimed success for work that did not happen (same anti-pattern as BUG-11/73).

It now attempts a real send via `sendEmail` and records what actually happened:

| Outcome | `status` | `errorMessage` |
|---|---|---|
| Provider accepted the message | `SENT` | (none) |
| `RESEND_API_KEY` unset (`provider-not-configured`) | `PENDING` | "Email provider not configured (RESEND_API_KEY unset) — not sent" |
| Provider configured but rejected the send | `FAILED` | "Email provider error (<reason>)" |
| Unexpected exception | `FAILED` | the exception message |

Idempotency uses `status IN ('SENT','PENDING')` for the same-day check, so a
re-run does not stack duplicate rows while the provider is absent; `FAILED` rows
are retried on the next run, which is the intended behaviour.

## Existing rows

No backfill is performed. Rows already marked `SENT` were written under the old
always-claim-success behaviour and cannot be distinguished from real sends after
the fact — rewriting them would destroy whatever signal they carry. They age out
of the same-day window naturally and no longer affect idempotency beyond today.

## Not applied

This note documents a **comment-only** schema change plus a route change; there
is nothing to run against the database. It exists so the status vocabulary is
recorded alongside the other manual migration notes.