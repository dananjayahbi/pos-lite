import { request } from '@playwright/test';

/**
 * INF-01 step 4 — env-readiness gate + route warm-up.
 *
 * - Fails fast with a clear message when the dev server is down (QA run 1 of
 *   Modules 31/32 was entirely ECONNREFUSED — wasted a full run).
 * - Warms the Turbopack compile cache: a cold dev server needs ~40 s per
 *   route, which blows past the specs' post-login URL assertions.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

const WARM_ROUTES = [
  '/login',
  '/dashboard',
  '/pos',
  '/inventory',
  '/categories',
  '/brands',
  '/customers',
  '/suppliers',
  '/settings',
  '/delivery',
  '/appointments',
  '/reports',
];

export default async function globalSetup() {
  let ctx;
  try {
    ctx = await request.newContext({ baseURL: BASE_URL });
    const res = await ctx.get('/login', { timeout: 120_000, maxRedirects: 5 });
    if (res.status() >= 500) {
      throw new Error(`server responded ${res.status()}`);
    }
  } catch (err) {
    throw new Error(
      `[preflight] ERP dev server is not reachable at ${BASE_URL}. ` +
        `Start it out-of-band ("yarn dev" inside erp/, needs --max-old-space-size=4096) ` +
        `and make sure the DB is seeded ("npx prisma db seed"). ` +
        `Reason: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Best-effort warm-up: 401/redirect statuses are fine, only compile time matters.
  for (const route of WARM_ROUTES) {
    try {
      await ctx.get(route, { timeout: 120_000, maxRedirects: 5 });
    } catch {
      /* ignore */
    }
  }
  await ctx.dispose();

  // M01-02 determinism: wipe the DB-backed forgot-password buckets so each
  // suite run starts from a full budget (the 6th-burst-request → 429
  // contract must not inherit a previous run's window). Best-effort —
  // harmless when the limiter runs in in-memory mode (table stays empty).
  try {
    const { config: dotenvConfig } = require('dotenv') as typeof import('dotenv');
    let url = process.env.DATABASE_URL;
    if (!url) {
      for (const envFile of ['.env.local', '.env']) {
        const parsed = dotenvConfig({ path: `${process.cwd()}/${envFile}` });
        if (!parsed.error && parsed.parsed?.DATABASE_URL) {
          url = parsed.parsed.DATABASE_URL;
          break;
        }
      }
    }
    if (url) {
      const { Client } = require('pg') as typeof import('pg');
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        await client.query('DELETE FROM rate_limit_buckets');
      } finally {
        await client.end();
      }
    }
  } catch (err) {
    console.warn('[globalSetup] rate-limit bucket reset skipped:', String(err));
  }
}
