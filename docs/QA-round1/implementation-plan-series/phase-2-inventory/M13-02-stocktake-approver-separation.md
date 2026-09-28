# M13-02 — BUG-43: stock-take approval does not enforce initiator/approver separation (+ OBS-23 lifecycle, OBS-24 approver seed)

**Severity:** P2-Major · **Module:** 13 Stock Takes · **QA pin:** `tests/13_stock_takes.spec.ts` (owner self-approval path) · **Depends on:** M03-08 (role seeds for a real distinct approver), M08/OBS-23 decision

## Verified source state (2026-09-15) — holds
- `src/app/api/store/stock-control/stock-takes/[sessionId]/approve/route.ts`: permission gate (30-35, `STOCK.approveStockTake`), status gate (58-63, `PENDING_APPROVAL`), and `initiatedById` referenced **only** as the notification recipient (~112) — **no comparison** between `session.user.id` and `stockTakeSession.initiatedById`. Same OWNER creates + completes + approves; the `approvedById` row equals `initiatedById`.
- **OBS-23 (holds):** `prisma/schema.prisma:126-132` `enum StockTakeStatus { IN_PROGRESS, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED }` — **no `DRAFT`**, despite the roadmap describing `DRAFT → IN_PROGRESS`. Live lifecycle starts at IN_PROGRESS.
- **OBS-24 (holds):** no seeded MANAGER/STOCK_CLERK credential, so distinct-role approval was only exercised via OWNER-approves + CASHIER-denied.

## Fix approach
1. **Maker-checker guard in the approve route:** after the status gate, `if (session.user.id === session_take.initiatedById) throw` → 403/409 "You cannot approve a stock take you initiated" (pick the code; 403 CONFLICT-style). Enforce at the API (the source of truth), not just UI.
   - Policy note: the client req says "different roles"; strictest safe reading is "different user id". Recommend: reject self-approval by **id** (covers same-owner) AND require the approver to hold `approveStockTake` (already gated). If the client wants "must be a different ROLE", add that too — flag for confirmation; id-based is the defensible default.
2. **OBS-23 lifecycle:** adding a `DRAFT` status is a schema+flow change (enum migration, create-as-draft endpoint, UI). QA verified the live IN_PROGRESS lifecycle and documented the discrepancy rather than failing. **Decision doc:** recommend keeping IN_PROGRESS-start (simpler, already tested) and correcting the *roadmap* wording, unless the client needs true drafts (counters prepared then opened). If DRAFT is chosen, it's its own REQ doc.
3. **OBS-24:** resolved by M03-08's known-password role seeds — once a MANAGER/STOCK_CLERK account exists, the suite can browser-verify a genuine second approver.

## Files
- `.../stock-takes/[sessionId]/approve/route.ts` (self-approval guard), tests; OBS-23 = roadmap/decision edit only.

## Acceptance / gate
- `tests/13`: owner self-approve → rejected (403); a second authorized user (post-M03-08 seed) approves → 200 + variance StockMovements + notification. CASHIER-denied + tenant-isolation pins stay green.
