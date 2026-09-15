# REQ-07 — Req 3.11: failed-delivery dashboard (Returned-to-Branch / Delivery-Failed management, redelivery/cancel triggers)

**Severity:** P2 (backend exists; end-to-end blocked + UI unproven) · **Type:** client-requirement gap · **Depends on:** M24-01 (courier auth — failure states can't be produced live until then) · **Refs:** req 3.11 "Failed Delivery Dashboard"

## Verified source state (2026-09-15)
- Status model supports the workflow: `enum DeliveryStatus` includes `FAILED` and `RETURNED` (schema.prisma). **Recovery API surface exists:** `src/app/api/store/deliveries/[id]/recovery/route.ts` + `recovery/redeliver/` + `recovery/cancel/` (route files present; `mapDeliveryError` has a `DELIVERY_NOT_RECOVERABLE` 409 branch — the contract is coded).
- The staff recovery metric is live (`api/reports/recovery-staff-performance`, gated `REPORT.viewRecoveryReport`, 200 for OWNER — Module 34) but returns empty because no courier recoveries can exist (BUG-60).
- **Unverified:** a dedicated operator dashboard *page* for FAILED/RETURNED orders (filtered list + redeliver/cancel actions wired to those routes) — QA never reached those states, so the UI affordance was never exercised.

## Fix approach
1. **Verify/complete the dashboard:** `/delivery` list filter chips for FAILED/RETURNED + row actions calling the existing recovery routes (redeliver = new attempt referencing `DeliveryRecovery`; cancel = terminal). If the page lacks these, add a `DeliveryRecoveryActions` component (modular, per existing DeliveryTable pattern).
2. **Populate via sandbox:** after M24-01, force a delivery to FAILED (courier sandbox status or a test hook) → assert the dashboard shows it, redeliver → status transitions + `DeliveryRecovery` row + audit; recovery report counts per staff (req bullet "Metric tracking successful package recoveries per staff member") populate.
3. Keep the recovery-report pin tolerant (empty-dataset contract already green).

## Acceptance / gate
- New `tests/24`-adjacent section: FAILED fixture → visible in dashboard → redeliver 200 / cancel 200 with typed states; recovery report non-empty for the acting staff. Req 3.11 failed-delivery bullets tickable post-M24-01.
