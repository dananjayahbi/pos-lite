# M32-01 — BUG-75: integer-overflow `page` param on the notifications feed → unhandled 500

**Severity:** P3-Minor · **Module:** 32 Notifications · **QA pin:** `tests/32_notifications.spec.ts` X3 · **Depends on:** XC-01 (shared safe-int guard)

## Verified source state (2026-09-15) — holds (with a repro nuance)
- `src/app/api/notifications/route.ts:25-26,34` — `limit = Math.min(Math.max(parseInt(...)||10,1),50)`; `page = Math.max(parseInt(searchParams.get('page') ?? '1',10) || 1, 1)`; `skip = (page-1)*limit`. No `Number.isSafeInteger` guard → an unsafe `skip` reaches Prisma → throw → generic catch → 500.
- **Repro nuance (found this pass):** QA's literal `page=99999999999999999999` → `parseInt` yields `1e20` → `skip≈1e21` (unsafe) → 500, but the string `1e20` itself would `parseInt` to `1` (stops at `e`) and be safe. The defect is the missing safe-int guard, not a specific string — XC-01's guard closes it regardless of input form.

## Fix approach
- Apply XC-01's `parseQueryInt` with a `Number.isSafeInteger` clamp: out-of-domain page → clamp to 1 (the route already clamps negatives to 1 — extend the same philosophy to overflow) or a typed 400. Recommend clamp-to-1 (matches the route's existing negative-page degradation, keeps the feed always-readable).

## Files
- `src/app/api/notifications/route.ts`, `src/lib/api/query-params.ts` (XC-01).

## Acceptance / gate
- X3 flips: `page=99999999999999999999` → 200 (clamped to page 1, empty or first window), never 500; existing pagination/clamp pins (F-series, P-series) unchanged.
