# REQ-11 — Req 1.4: petty-cash In/Out records logged during an active shift (unchecked bullet; shift open/close already verified)

**Severity:** P2 (req bullet open; machinery mostly present) · **Type:** client-req gap · **Depends on:** M19-01 (overdraw policy), M18-01 (report display verification) · **Refs:** req 1.4 bullets 1 ✅ / 2 (M18-01 covers) / 3 open

## Verified source state (2026-09-15)
- Shift open/close with floats: ✅ verified (API tests). Cash over/short display: exists in the Z-report page (M18-01). **Open bullet:** "Petty cash In/Out records logged during an active shift" — the `CashMovement` model + `shifts/[id]/cash-movements` route exist (Module 18 inspect paths), and the shift-report page embeds a `<PettyCashSection shiftId=… isOpen=…>` (shift-report/page.tsx:226-228) — so the surface appears present but was **never browser-verified end-to-end** (the shift module's suite died at BUG-52 before exercising it).

## Fix approach (verification + small gaps)
1. With INF-01/M18-01: run `tests/18` fully; assert during an OPEN shift: record an In and an Out cash movement → rows persist with type/amount/note/actor, reflect in the live Z-report PettyCash section, and the shift-close snapshot includes them in `cashDifference` math.
2. Verify the movement UI (buttons in the POS/shift screens) enforces "active shift required" and rejects negative amounts client+server (the API contract per M09-02's bounds style).
3. If the PettyCashSection is read-only display without entry controls during an open shift, add the In/Out quick-entry (small component) — decide after the verification run; don't build blind.

## Acceptance / gate
- tests/18 green + new case: In/Out during open shift → ledger + report math; req 1.4 all three bullets tickable.
