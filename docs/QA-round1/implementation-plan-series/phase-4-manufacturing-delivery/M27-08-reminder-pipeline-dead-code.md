# M27-08 — OBS-77: appointment reminder pipeline is dead code (zero callers, no cron, no-op send that marks SENT)

**Severity:** P2-Major (req 3.3 "24h reminders" cannot fire at all) · **Module:** 27 Appointments / 31 Comms · **QA ref:** F1 (`reminders:[]` always) · **Depends on:** M27-03 (IDOR fix first — don't wire a vulnerable surface), M31-01/INF-03 (provider config), M27-02 (gates)

## Verified source state (2026-09-15) — holds
- `src/lib/services/appointment-reminder.service.ts`: `scheduleReminders` (:12) and `processPendingReminders` (:58) have **zero call sites** repo-wide (grep-confirmed; no cron route imports them; `vercel.json` has no crons block for it).
- The send path `:80-94`: `// TODO: Integrate with WhatsApp service when available` — the actual send is commented out and the code **unconditionally marks reminders `SENT`** — a fake-send that would corrupt the ledger if the pipeline were ever wired as-is. `buildReminderMessage` (:120) is only referenced by the commented line.

## Fix approach (make the pipeline real, honestly)
1. **Wire the clock:** add `src/app/api/cron/appointment-reminders/route.ts` (mirror the existing cron auth pattern — bearer `CRON_SECRET`, fail-closed like `payment-reminders`) calling `processPendingReminders()`; register in `vercel.json` crons (and document the self-hosted alternative). Scheduling hook: call `scheduleReminders` from appointment create/confirm (the 24h-before rows) inside the same transaction or right after commit.
2. **Honest send:** replace the no-op with the real channel decision — email via `sendEmail` (works once RESEND configured) and/or WhatsApp via `sendWhatsAppTextMessage` (M31's channel); **only mark `SENT` on provider success**, `FAILED` with error otherwise; retry semantics minimal (next cron pass re-picks pending/failed).
3. Until INF-03 provides credentials, the cron exists but sends fail → rows stay PENDING/FAILED (visible), never fake-SENT.
4. Keep the reminders API read path (M27-03-fixed) as the UI surface; the appointment detail can show reminder history.

## Files
- new cron route, `vercel.json`, `appointment.service.ts` (schedule hook), `appointment-reminder.service.ts` (real send + status), cron-auth helper reuse.

## Acceptance / gate
- New `tests/27` section: confirm appointment → PENDING reminder rows exist (24h window math); cron without secret → 401 (pattern parity); with secret + unconfigured provider → rows FAILED (not SENT); req 3.3 reminder bullet stays `[ ]` until a provider is configured (gated by INF-03, same as req 3.5).
