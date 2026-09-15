# M02-04 — GAP-4 duplicate search inputs (STALE — already fixed) + OBS-1 cashier POS dialog automation note

**Severity:** P3 / documentation · **Module:** 02 Products · **QA refs:** `tests/02_inventory.spec.ts` `search:` strict-mode workaround; OBS-1 · **Depends on:** nothing

## Verified source state (2026-09-15) — GAP-4 no longer holds
- `src/components/inventory/InventoryFilterBar.tsx:95-98` renders **exactly one** `<Input placeholder="Search by name, SKU, or barcode…">`. Repo-wide grep for that placeholder → 1 hit only; the file's other two inputs are "Search categories…"/"Search brands…" popover fields (`:263`, `:324`), not duplicates. `InventoryListClient.tsx:159` mounts the filter bar once; no `hidden`/responsive duplicate remains.
- The QA test still scopes with `.locator('visible=true')` and carries an **out-of-date comment** about a duplicate (`docs/QA-round1/tests/02_inventory.spec.ts:313-317`).

## Action (verification-only, no product code)
1. **Confirm closed:** run the `search:` test as-is; it passes because the duplicate is gone. Update the stale comment in the relocated spec (INF-01 relocation) so future readers aren't misled.
2. **Record OBS-1** for all suites: `cashier1@ayurpos.dev` sign-in opens an "Open POS — new tab / this tab / Close" dialog and does **not** auto-redirect (intentional product behavior; M01-05 keeps it). Automation must click "Open in this tab". This is a **harness contract**, not a defect — list it in the ROADMAP's test-authoring notes so every cashier-login spec handles it (M01-07, M20-01 depend on it).

## Acceptance
- No pin to flip. Mark GAP-4 **CLOSED (fixed in source, verified 2026-09-15)** in the next QA round; keep OBS-1 as a standing automation note.
