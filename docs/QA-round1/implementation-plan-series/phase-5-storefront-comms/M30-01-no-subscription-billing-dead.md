# M30-01 — BUG-70: no subscription exists for any tenant — the entire billing UI is unreachable (dead provisioning path)

**Severity:** P1-Critical (SaaS billing cannot onboard a tenant in any fresh deployment) · **Module:** 30 Payments/Billing · **QA pin:** `tests/30_payments_billing.spec.ts` F1 (gate pin — asserts redirect today, flips to full-UI on fix) · **Depends on:** M08-05 (plan seeding), INF-03 (PayHere config for checkout) · **Blocks:** REQ-05

## Verified source state (2026-09-15) — holds
- `src/lib/billing/subscription.service.ts:4` `createTrialSubscription` — repo-wide grep + LSP usages: **only the definition, zero callers** (dead code).
- `src/app/(store)/billing/page.tsx:35-38` — `getSubscriptionForTenant(tenantId)` null → `redirect('/')`; `/billing/payment-methods` same; `initiateCheckout` always "No subscription found".
- `prisma/seed.ts` creates no Subscription/Invoice rows (grep empty). All `SubscriptionPlan` rows seeded `isActive:false` (OBS-48: even a wired caller needs an active plan — M08-05 seeds one).

## Fix approach (wire the provisioning path)
1. **Call `createTrialSubscription` at tenant provisioning:** in the superadmin tenant-create flow (wherever a tenant row is created — note business creation is currently capped at 2 + `/new` is a stub, OBS-14; the hook still belongs there for when the cap lifts) AND in seed for the demo tenant. Requires an active plan (M08-05) — sequence after it.
2. **Seed a TRIAL subscription** for dilani (and optionally lanka) so `/billing` renders in dev/QA and the F1 gate pin can be upgraded to the real checkout lifecycle (invoice → PayHere → activation → renewal → cancel), which is otherwise untestable end-to-end.
3. **Decide the trial policy** (duration, plan, auto-grace) with the client — record it; the existing `GRACE_PERIOD_DAYS=7`/30d/365d math (QA-verified contracts) is the substrate.
4. Keep `getSubscriptionForTenant` null-redirect as the honest fallback (a tenant genuinely without a subscription should not see billing chrome).

## Files
- `subscription.service.ts` (callers), tenant-create route/service, `prisma/seed.ts`, `tests/30` F1/L1/S5/A1 gate pins upgraded.

## Acceptance / gate
- F1 flips: `/billing` renders for the seeded tenant; cancel route returns the real subscription contract (not just 404 "No subscription found"); a full checkout→invoice lifecycle test becomes possible (still gated on M30-02 for the PayHere leg).
