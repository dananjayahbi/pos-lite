# XC-05 — Soft-delete / restore / deprovision policy: make reversibility promises real, uniformly

**Severity:** P2 (data-loss-adjacent) · **Type:** cross-cutting · **Depends on:** INF-02, XC-04 (shared docs) · **Members:** BUG-20 (M02-03), OBS-10 (M06-05), GAP-4 (M03-08 area), OBS-45 (website reset), OBS-63 (M33-03), OBS-42, recreate-after-delete family (BUG-21/90)

## Verified source state (2026-09-15) — the delete story differs per entity, mostly badly
| Entity | "Delete" mechanism | Restore path | Notes |
|---|---|---|---|
| Product | `isArchived` toggle (recoverable) AND `deletedAt` soft delete | **none** — DELETE message *promises* restorability, no route clears `deletedAt`; archive route 404s on deleted rows (BUG-20) | worst case |
| Category/Brand | `deletedAt` soft delete | none — name stays reserved (unique ignores deletedAt) → recreate = 409 (BUG-21 leak half) | |
| Customer | `deletedAt` + isActive false | none; phone has no unique so recreate-after-delete → **201** (A3) — opposite policy from Category | inconsistent |
| Supplier | `isActive:false` archive only, no DELETE (405) | **none** (PATCH ignores isActive) — one-way (OBS-10) | |
| Staff | `isActive` PATCH; `User.deletedAt` never set | none; no DELETE route (GAP-4) — deactivated rows accumulate forever | |
| Webhook endpoint | hard delete, **cascades delivery ledger destruction** (OBS-63) | n/a | contradicts convention |
| Website config | `DELETE /website` = hard reset, nulls everything + deletes slides/ads (OBS-45) | none (no undo; QA snapshots to survive) | |
| Appointment | DELETE = soft cancel (row survives) | n/a (sane) | |
| Batch | no delete at all (permanent receipts, OBS-83) | n/a (deliberate) | |

## Fix approach (policy first, then per-entity conformance)
1. **Canonical vocabulary:** *Archive* (isActive/isArchived — reversible, listed under a filter) ≠ *Soft delete* (`deletedAt` — hidden, restorable by an authorized actor) ≠ *Hard delete* (forbidden except for transient/config data with an explicit decision). Every user-facing "Delete" button must map to Archive or Soft-delete with a documented restore affordance.
2. **Restore endpoints where promised:** Product restore (M02-03 defines it) becomes the template; suppliers get unarchive (M06-05); categories/brands get a "restore + rename conflict" flow OR keep reserved-names policy with a clear 409 message (client decision).
3. **Recreate-after-soft-delete policy:** choose ONE across entities — recommend **soft-deleted rows keep reserving the unique name** (Category/Brand behavior) with a friendly 409 (via INF-02) — meaning Customer's 201-after-delete (A3) and M27-05's 500 all converge to friendly-409. Update pins accordingly.
4. **Deprovision (GAP-4):** staff gets `deletedAt` set via a new DELETE route (OWNER-only, guarded, audit) that deprovisions while audit rows persist (they reference actorId, not the user row) — resolves the roster-accumulation complaint without breaking append-only audit.
5. **Webhook endpoints:** soft-delete (M33-03) so delivery ledgers survive.

## Files
- per-entity routes/services listed in member docs; `docs/lifecycle-policy.md` (new, the canonical vocabulary); UI copy sweep ("Archive"/"Delete" labels + confirm dialogs).

## Acceptance / gate
- Member pins (tests/02 E7, tests/05 A3, tests/06 A-series, tests/29 A2, tests/33 delete-cascade) updated to the chosen policy; a new cross-entity lifecycle spec asserts: archive→unarchive round-trip, soft-delete→restore round-trip, hard-delete only where explicitly allowed.
