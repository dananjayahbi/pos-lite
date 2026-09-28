# XC-02 — Response-envelope consistency: one shape for success/errors, one 401-vs-403 policy

**Severity:** P2 (integrator-facing; harness-breaking) · **Type:** cross-cutting · **Depends on:** INF-02 · **Members:** BUG-59, OBS-13, OBS-37, OBS-46, OBS-59-adjacent

## Verified source state (2026-09-15)
Three shape/policy inconsistencies QA tripped over:
1. **`/api/audit-logs` envelope (BUG-59):** packaging test A1 died on `TypeError: (auditJson.data || []).find is not a function` — the route's `data` is a **paginated object** (`{ total, rows, … }`-style), while most list routes return `data` as an array. The response shape differs per route family with no documentation. (Module 25's harness note confirms: audit assertions had to target `data.data`.)
2. **Unauth code policy (OBS-13/46):** superadmin route family mixes 403 (tenant list, settings) / 401 (feature-modules) / 200 (internal bridge, by design); `admin/plans` answers 403 for unauthenticated callers. QA pinned `[401,403]` tolerance in two specs because the codes are unpredictable.
3. **Filter-validation philosophy (OBS-37):** reconciliation rejects `limit>200`/`page=0` with 400 while customers/suppliers CLAMP the same inputs — opposite behaviors for the same param concept.

## Fix approach
1. **Document + enforce the envelope:** success = `{ success:true, data:<payload>, meta?:{page,limit,total,hasMore} }`; error = `{ success:false, error:{ code, message, details? } }` — INF-02's builders already do the error half. Normalize `audit-logs` (and any other object-`data` list route) to array-`data` + `meta`. Publish the contract in a short `docs/api-envelope.md` for integrators + future agents.
2. **Code policy:** missing/invalid session → **401** everywhere; authenticated-but-forbidden → **403**; cross-tenant resource miss → **404** (established). Sweep the superadmin family + `admin/plans` to match; keep `/api/internal/*` + webhooks exempt (documented exceptions).
3. **Clamp-vs-reject:** pick clamp-for-pagination (the majority pattern: customers/suppliers/batches/notifications post-XC-01) and reject-for-domain-filters (status enums, dates). Reconciliation route migrates to clamp; update its F7 pin.
4. Update the QA specs' tolerant assertions to strict ones once the policy is uniform (each spec change noted in its module doc).

## Files
- `api/audit-logs/route.ts`, superadmin family, `admin/plans/route.ts`, `api/store/reconciliation/*` filters, `docs/api-envelope.md` (new).

## Acceptance / gate
- New envelope-contract Vitest; `tests/23` A1 parses `data` as array; `tests/08/26/30` unauth matrix asserts exact codes; F7 (recon pagination) flips to clamp.
