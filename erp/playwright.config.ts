import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E harness — recreated per docs/QA-round1/QA_ROADMAP.md
 * Appendix C (the patched config QA ran round 1 with). INF-01.
 *
 * - baseURL defaults to http://localhost:3003 (override: PLAYWRIGHT_BASE_URL).
 * - Serial execution (fullyParallel: false, workers: 1) — stopgap documented
 *   in Appendix C.7; specs use run-id-suffixed data + self-cleanup.
 * - Chromium only by default; QA_ALL_BROWSERS=1 restores the full matrix.
 * - webServer intentionally disabled — the ERP needs --max-old-space-size=4096
 *   and a pre-seeded DB; start it out-of-band (`yarn dev` in erp/).
 * - outputDir is wiped each run — never store fixtures there (Appendix C.8).
 */

const ALL_BROWSERS = process.env.QA_ALL_BROWSERS === '1';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: './test-results',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ALL_BROWSERS
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
