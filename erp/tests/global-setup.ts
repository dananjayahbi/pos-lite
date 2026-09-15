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
}
