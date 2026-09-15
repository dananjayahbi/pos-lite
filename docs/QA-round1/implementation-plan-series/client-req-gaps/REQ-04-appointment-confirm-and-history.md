# REQ-04 — Req 3.3 (portal): appointment booking confirmation SMS/Email + unified patient history surface

**Severity:** P2 (client req, partially blocked) · **Type:** client-requirement gap · **Depends on:** M31-01 (comms provider), M27-08 (reminder pipeline), M27-01 (convert-to-sale for purchase history)

## Verified source state (2026-09-15)
- Public booking works (Module 27: unauth → 201 lands in tenant feed). **No confirmation message** is sent on booking — the appointment service has no create-notification/comms hook, and the only comms path (reminders) is dead code (M27-08) blocked on provider config (M31-01).
- **Unified patient history** (req 3.3: "Link appointments to retail purchase history & medical notes"): appointment↔sale linkage is created by convert-to-sale, which always 500s (M27-01). Medical notes exist on the appointment (free-text); there is no single patient-view page joining appointments + purchases.

## Fix approach
1. **Booking confirmation:** on appointment create (both public and manual), enqueue an email (and WhatsApp if configured) confirmation via the shared send helpers (M31-01's structured-reason path). Reuse the reminder pipeline's message builder. Delivered only once a provider exists (INF-03); until then, record PENDING (never fake-SENT — same rule as M27-08).
2. **Patient history page:** a customer-detail extension (or appointment-detail) showing that customer's appointments + their linked sales (post-M27-01) + notes. New component under `src/app/(store)/customers/[customerId]/` or `/appointments/[id]/` — decide placement with the client; data joins already exist once convert-to-sale works.
3. Both are gated on infra (M31-01, M27-01); sequence those first.

## Acceptance / gate
- Booking → confirmation row created (SENT with provider, PENDING without); a patient-history view lists appointments + purchases for a linked customer. Req 3.3 portal bullets tickable.
