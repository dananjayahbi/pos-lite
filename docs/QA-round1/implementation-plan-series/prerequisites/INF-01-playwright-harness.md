# INF-01 — Restore the Playwright E2E harness

**Type:** prerequisite / enabler · **Severity:** P1 (blocks every fix gate) · **Depends on:** nothing · **Blocks:** every `GATE` status in the series

## Why this exists
Every bug doc names a Playwright spec as its acceptance gate (e.g. `tests/01_auth.spec.ts`). But on this branch (`QA-R1` == `web-refactor`) **the Playwright harness does not exist in `erp/`**:
- `erp/tests/` — absent.
- `erp/playwright.config.ts` — absent.
- `@playwright/test` — not a dependency in `erp/package.json` (only Vitest, `vitest ^3.2.4`, script `"test": "vitest run"`; ~24 unit files under `erp/src/**/__tests__/`).
- The QA suites live only as static files in `docs/QA-round1/tests/*.spec.ts`.

`QA_ROADMAP.md` Appendix C describes a patched config (baseURL `http://localhost:3003`, serial `workers:1`, chromium-only, `webServer` disabled, HTML reporter `open:'never'`) that was applied on the QA checkout but is **not present here**. Without it, no fix can be verified the way QA verified the bug.

## Goal
Recreate the exact harness QA used, so the delivered specs run unchanged and each fix's defect-pin can be flipped and re-run in isolation.

## Steps (modular, no monolith edits)
1. Add `@playwright/test` as a devDependency; add scripts `test:e2e` (chromium, serial) and `test:e2e:all-browsers` (gated by `QA_ALL_BROWSERS=1`).
2. Create `erp/playwright.config.ts` mirroring Appendix C: `testDir` pointing at the relocated specs, `baseURL` from `PLAYWRIGHT_BASE_URL` defaulting to `http://localhost:3003`, `fullyParallel:false`, `workers:1`, projects = chromium only by default, reporter html `open:'never'`, `outputDir` = `erp/test-results` (note: this dir is wiped each run — never store fixtures there).
3. Relocate specs: copy `docs/QA-round1/tests/*.spec.ts` into `erp/tests/` (keep `example.spec.ts` out). Preserve filenames so doc references (`tests/NN_*.spec.ts`) stay valid. Keep the originals in `docs/` as the QA-of-record copy; treat `erp/tests/` as the runnable mirror.
4. Env-readiness gates: the suites assume seeded Postgres + started dev server. Document a preflight (server reachable on :3003, DB seeded via `pnpm prisma db seed`, feature modules `appointments`+`delivery` enabled for Phase 4/5 specs). Add a global setup that fails fast with a clear message if the server is down (QA run 1 of Module 31/32 was entirely ECONNREFUSED — wasted a full run).
5. Credentials: point specs at `TEST_CREDENTIALS.md` accounts; note the login rate limit (10 fails / IP / 15 min) so suites reuse `storageState` (the delivered specs already cache logins — keep that behavior).

## Acceptance / gate
- `npx playwright test tests/01_auth.spec.ts --list` succeeds (config resolves, imports compile).
- One already-green spec (e.g. `tests/04_categories_brands.spec.ts`, QA-reported 31/31) runs end-to-end green against a fresh seeded DB with **no source changes** — proving the harness matches QA's.
- A single defect-pin spec (e.g. `tests/02_inventory.spec.ts`, QA-reported 1 intentional failure = BUG-1 pin) reproduces exactly that one failure — proving pins behave as documented.

## Notes for implementer
- Do NOT enable `webServer` — the app needs `--max-old-space-size=4096` and a pre-seeded DB; it is started out-of-band (`qa-start.cmd` / `yarn dev`).
- Serial execution is a stopgap; specs already use run-id-suffixed data + self-cleanup. Do not attempt parallelization in this doc.
- This doc changes no application behavior — it is test infrastructure only.
