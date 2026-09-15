# M19-01 — BUG-53: petty-cash fund balance goes negative silently on linked expenses (policy decision + guard)

**Severity:** P2-Major (accounting policy undefined) · **Module:** 19 Expenses/Petty Cash · **QA pin:** `tests/19_expenses_petty_cash.spec.ts` F3 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/lib/services/petty-cash.service.ts:365-376` `adjustFundBalance`: `next = currentBalance + delta` → writes `currentBalance: next.toNumber()` — **no non-negative check**.
- `recomputeCurrentBalance` (132-145): `openingBalance − Σ linked expenses` — can go negative by construction.
- `src/lib/services/expense.service.ts:77-78` create-with-`pettyCashFundId` → `adjustFundBalance(…, -amount)` unconditionally; edit/delete paths (118-141) adjust symmetrically. A linked expense exceeding the float silently produces a negative `currentBalance` (QA F3 assertion failure).
- The low-balance alert machinery exists (`evaluateLowBalance` 183-214, `PETTY_CASH_LOW` notification) — the system warns on low but never blocks overdraft.

## Fix approach (decision first — record, then implement)
1. **Policy question for the client:** is an overdrawn petty-cash float (a) forbidden, (b) allowed with an override/approval, or (c) allowed and simply reported? QA flagged the ambiguity; the ERP's existing low-balance alert suggests (c)-leaning. **Recommend (b):** block by default with an OWNER/MANAGER override flag on the expense.
2. Implementation (under (b)): in `createExpense` before `adjustFundBalance` — if `fund.currentBalance − amount < 0` throw `PETTY_CASH_OVERDRAW` (typed 422 via INF-02) unless body carries `overdrawApproved:true` and the actor has a manager-ish permission; audit `PETTY_CASH_OVERDRAW_APPROVED` with actor.
3. `recomputeCurrentBalance` never blocks (recomputation of history can legitimately end negative) — guard applies at the *write* decision point only.
4. UI: expense form shows the fund's live balance next to the picker; submitting an overdraft prompts the approval checkbox (new small component, not an inline append).
5. If the client picks (c): implement only the explicit negative-balance badge + keep F3's assertion flipped to "negative allowed and surfaced".

## Files
- `petty-cash.service.ts`, `expense.service.ts`, `api/store/expenses/route.ts`, expense form component, audit constants.

## Acceptance / gate
- `tests/19` F3 flips to the chosen policy (default: overdraft → 422; approved → 201 with negative balance + audit row). Balance-equation preservation tests stay green.
