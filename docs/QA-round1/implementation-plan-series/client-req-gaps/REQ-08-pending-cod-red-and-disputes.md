# REQ-08 — Req 3.7: pending-COD dashboard ROW-level RED highlighting + dispute end-to-end (post-gate)

**Severity:** P2 (blocked by BUG-65/60 chain; card-level exists, row-level unproven) · **Type:** client-req gap · **Depends on:** M26-01 (engine gate), M24-01, M26-02 (dispute 500s) · **Refs:** req 3.7 "Delivered but unpaid orders highlighted in RED"

## Verified source state (2026-09-15)
- The reconciliation dashboard renders aging **cards** (Under 7 / Under 14 / Overdue in `text-terracotta`) with correct zero-base math (Module 26 F2/P1) — but the client asked for **delivered-but-unpaid ORDERS highlighted in RED** (row treatment). OBS-39: with an empty ledger, row-level styling is unverifiable; the terracotta cards are the closest existing affordance.
- Dispute lifecycle API is coded (POST/PATCH, validation green) but 500s on routine errors (M26-02) and can never target a real entry (empty ledger).

## Fix approach
1. On the dashboard's ledger table, apply row-level emphasis: `status = PENDING_SETTLEMENT && age > 14d` → red row treatment (left border + badge, terracotta token already in the theme); in-window rows neutral. Decide exact rule with client (RED = overdue-only vs all pending — req wording suggests unpaid-after-delivery = all pending, but a wall of red is useless; recommend overdue-red + pending-amber).
2. Dispute button per row (exists at API level; wire the UI action to POST with the entry id) + status badge when disputed.
3. All of this becomes verifiable only when M26-01's gate lifts (valid courier creds → DELIVERED → ledger rows). Keep F8/L1 gate pins as the tripwire.

## Acceptance / gate
- With populated sandbox ledger: overdue pending-COD rows render red (DOM class assertion); dispute open from a row → badge + `ALREADY_DISPUTED` 409 on second attempt (after M26-02); req 3.7 pending-COD bullets tickable.
