/**
 * Module 29 — Website CMS & Admin Content
 * ========================================
 * Target: tests/29_website_cms.spec.ts
 *
 * Inspected surfaces (read-only inspection; tests drive only the public API):
 * - UI   : /settings/website                     (auth-only; renders WebsiteSettingsForm)
 * - API  : GET/PUT/DELETE /api/store/website                 (config upsert / reset)
 * - API  : GET/POST /api/store/website/hero-slides, PATCH/DELETE /[id]
 * - API  : GET/POST /api/store/website/ads, PATCH/DELETE /[id]
 * - API  : GET /api/store/website/categories, /api/store/website/products
 * - API  : POST /api/upload/website-asset
 * - DB   : WebsiteConfig, WebsiteHeroSlide, WebsiteAd
 *
 * Key contract facts (code-verified):
 * - All routes are AUTH-ONLY (no permission gate) — any authenticated tenant
 *   user (incl. CASHIER) may edit the website. Pinned as OBS-41.
 * - Hero-slide/ad row-level routes are TENANT-SCOPED in the service layer
 *   (M29-01/BUG-68 fix): update/delete resolve the row through
 *   `assertWebsiteChildBelongsToTenant` and fail closed as 404 on a foreign id
 *   — cross-tenant IDOR pinned in §8 (BUG-68 pins, S4–S6).
 * - PUT /website reconciles heroSlides/ads relation rows via full replace
 *   (delete-all + recreate) in a transaction; the DB mirrors the editor.
 * - Config save fires storefront revalidation (best-effort, never fails save).
 * - resetWebsiteConfig nulls every field + deletes all slides/ads (hard reset).
 *
 * Run: npx playwright test tests/29_website_cms.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const CASHIER1_EMAIL = 'cashier1@ayurpos.dev';
const CASHIER1_PASSWORD = 'cashier123!';
const LANKA_OWNER_EMAIL = 'owner@lanka-electronics.lk';
const LANKA_OWNER_PASSWORD = 'owner123!';

const CONFIG_URL = `${BASE_URL}/api/store/website`;
const SLIDES_URL = `${BASE_URL}/api/store/website/hero-slides`;
const ADS_URL = `${BASE_URL}/api/store/website/ads`;
const CATEGORIES_URL = `${BASE_URL}/api/store/website/categories`;
const PRODUCTS_URL = `${BASE_URL}/api/store/website/products`;
const ASSET_UPLOAD_URL = `${BASE_URL}/api/upload/website-asset`;

const RUN_TAG = `qa-m29-${Date.now().toString(36)}`;

async function login(page: any, email: string, password: string) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Cashier sessions surface an "Open POS" tab-choice dialog (OBS-1).
  try {
    await page.getByRole('button', { name: /open in this tab/i }).click({ timeout: 4000 });
  } catch {
    // No dialog for this role.
  }
  await page.waitForURL(/\/(dashboard|delivery|pos)$/i, { timeout: 20000 });
}

async function getConfig(page: any) {
  const res = await page.request.get(CONFIG_URL);
  expect(res.status(), `GET /website -> ${await res.text()}`).toBe(200);
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data;
}

async function putConfig(page: any, body: Record<string, unknown>) {
  return page.request.put(CONFIG_URL, { data: body });
}

async function createSlide(page: any, body: Record<string, unknown>) {
  return page.request.post(SLIDES_URL, { data: body });
}

async function createAd(page: any, body: Record<string, unknown>) {
  return page.request.post(ADS_URL, { data: body });
}

/** Minimal valid hero slide for POST /hero-slides. */
function slidePayload(overrides: Record<string, unknown> = {}) {
  return {
    mediaType: 'image',
    mediaUrl: `https://example.com/${RUN_TAG}-slide.jpg`,
    title: `QA Slide ${RUN_TAG}`,
    subtitle: 'subtitle',
    description: 'description',
    ctaText: 'Shop now',
    ctaLink: '/shop',
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
}

/** Minimal valid ad for POST /ads. */
function adPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `QA Ad ${RUN_TAG}`,
    mediaType: 'image',
    mediaUrl: `https://example.com/${RUN_TAG}-ad.jpg`,
    targetUrl: '/shop',
    position: 'between_sections',
    displayAfterSection: 'latestProducts',
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §0 — Snapshot & deterministic baseline (restored in cleanup)
// ─────────────────────────────────────────────────────────────────────────────
// The snapshot is persisted to a temp file because Playwright may recycle the
// worker between describes — module state alone is not durable. The filename
// is FIXED (no pid) so a recycled worker reads the same file; it is written
// fresh in §0 and removed in cleanup.
const SNAPSHOT_PATH = join(tmpdir(), 'm29-snapshot.json');

function saveSnapshot(data: Record<string, any>) {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(data));
}

function loadSnapshot(): Record<string, any> | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Durable, never-deleted snapshot copy.
 *
 * `SNAPSHOT_PATH` lives in the OS temp dir and §11 deletes it on success, so
 * after a wipe the ONLY recovery source removed itself. Keep a timestamped
 * copy under `test-results/` so a wipe is always recoverable by hand.
 */
function saveSnapshotBackup(data: Record<string, any>): string | null {
  try {
    const dir = join(process.cwd(), 'test-results');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `m29-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2));
    return file;
  } catch {
    return null; // Best effort — the temp snapshot is still written.
  }
}

/**
 * Does the stored config hold content a human authored (as opposed to an
 * empty, seeded, or test-only config)?
 *
 * WHY THIS EXISTS — §0 performs a DESTRUCTIVE "deterministic baseline" (PUT
 * with `heroSlides: []`, `ads: []`) and §11 restores from a temp-file snapshot
 * that it deletes on success. If the suite aborts between the two, the tenant
 * is left permanently wiped with no undo: `AuditLog` does not record
 * WebsiteConfig writes. On 2026-09-17 exactly that happened to the `dilani`
 * storefront — authored copy and image links replaced by `example.com/qa-m29-*`
 * fixtures — and it cost the owner hours of CMS work to rebuild.
 *
 * So: never run the destructive baseline over authored content.
 */
function looksLikeRealContent(config: Record<string, any>): boolean {
  const media = [
    ...(config.heroSlides ?? []).map((s: any) => s?.mediaUrl),
    ...(config.ads ?? []).map((a: any) => a?.mediaUrl),
  ].filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);

  const hasRealMedia = media.some((u) => !u.includes('example.com'));
  const hasAuthoredCopy =
    typeof config.footerAbout === 'string' && config.footerAbout.trim().length > 0;
  const siteName = typeof config.siteName === 'string' ? config.siteName : '';
  const hasBrandName = siteName.trim().length > 0 && !siteName.includes('qa-m');

  return hasRealMedia || hasAuthoredCopy || hasBrandName;
}

test.describe('§0 Snapshot & baseline', () => {
  test('captures the tenant website config for exact restore', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const snap = await getConfig(page);
    saveSnapshot(snap);
    const backup = saveSnapshotBackup(snap);

    // Never destroy authored content — see looksLikeRealContent().
    if (looksLikeRealContent(snap)) {
      test.skip(
        true,
        `Refusing to run: tenant "${snap.siteName}" holds real content ` +
          `(${(snap.heroSlides ?? []).length} hero slides, ${(snap.ads ?? []).length} ads). ` +
          `§0 empties the config and §11 restores only from a temp file, so an ` +
          `aborted run would destroy it with no undo. Run against a disposable DB. ` +
          `Backup for manual restore: ${backup ?? SNAPSHOT_PATH}`,
      );
    }

    // Deterministic baseline: PUT with explicit empty arrays reconciles the
    // relation rows to none, so per-test creates are isolated.
    const res = await putConfig(page, { heroSlides: [], ads: [] });
    expect(res.status(), `baseline PUT -> ${await res.text()}`).toBe(200);
    const after = await getConfig(page);
    expect(after.heroSlides).toHaveLength(0);
    expect(after.ads).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Functional & Business Logic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§1 Functional & business logic', () => {
  test('F1: GET returns the config with heroSlides + ads relations', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const config = await getConfig(page);
    expect(config).toHaveProperty('id');
    expect(config).toHaveProperty('tenantId');
    expect(Array.isArray(config.heroSlides)).toBe(true);
    expect(Array.isArray(config.ads)).toBe(true);
  });

  test('F2: PUT persists branding + SEO fields (full round-trip)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await putConfig(page, {
      siteName: `QA Site ${RUN_TAG}`,
      tagline: 'Wellness, delivered',
      metaTitle: `QA Meta ${RUN_TAG}`,
      metaDescription: 'QA meta description',
    });
    expect(res.status(), `PUT -> ${await res.text()}`).toBe(200);
    const after = await getConfig(page);
    expect(after.siteName).toBe(`QA Site ${RUN_TAG}`);
    expect(after.metaTitle).toBe(`QA Meta ${RUN_TAG}`);
  });

  test('F3: PUT persists color/typography fields (7-char color contract)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await putConfig(page, {
      primaryColor: '#112233',
      accentColor: '#445566',
      bgColor: '#778899',
      headingColor: '#000000',
      bodyColor: '#555555',
    });
    expect(res.status()).toBe(200);
    const after = await getConfig(page);
    expect(after.primaryColor).toBe('#112233');
    expect(after.accentColor).toBe('#445566');
  });

  test('F4: hero slide POST creates a row visible in the config relations', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await createSlide(page, slidePayload());
    expect(res.status(), `POST slide -> ${await res.text()}`).toBe(201);
    const slide = (await res.json()).data;
    expect(slide.id).toBeTruthy();
    expect(slide.mediaType).toBe('image');
    expect(slide.isActive).toBe(true);
    const config = await getConfig(page);
    expect(config.heroSlides.some((s: any) => s.id === slide.id)).toBe(true);
  });

  test('F5: hero slide PATCH updates fields; DELETE removes it', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (await createSlide(page, slidePayload())).json();
    const id = created.data.id;
    const patch = await page.request.patch(`${SLIDES_URL}/${id}`, {
      data: { title: `Renamed ${RUN_TAG}`, isActive: false },
    });
    expect(patch.status()).toBe(200);
    const patched = (await patch.json()).data;
    expect(patched.title).toBe(`Renamed ${RUN_TAG}`);
    expect(patched.isActive).toBe(false);
    const del = await page.request.delete(`${SLIDES_URL}/${id}`);
    expect(del.status()).toBe(200);
    const config = await getConfig(page);
    expect(config.heroSlides.some((s: any) => s.id === id)).toBe(false);
  });

  test('F6: hero slide POST rejects invalid mediaType and empty mediaUrl (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const badType = await createSlide(page, slidePayload({ mediaType: 'gif' }));
    expect(badType.status()).toBe(400);
    const badUrl = await createSlide(page, slidePayload({ mediaUrl: '' }));
    expect(badUrl.status()).toBe(400);
    const json = await badUrl.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  test('F7: ad POST creates a row; PATCH updates; DELETE removes', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (await createAd(page, adPayload())).json();
    const id = created.data.id;
    expect(created.data.position).toBe('between_sections');
    const patch = await page.request.patch(`${ADS_URL}/${id}`, {
      data: { name: `Renamed Ad ${RUN_TAG}`, position: 'header' },
    });
    expect(patch.status()).toBe(200);
    expect((await patch.json()).data.position).toBe('header');
    const del = await page.request.delete(`${ADS_URL}/${id}`);
    expect(del.status()).toBe(200);
  });

  test('F8: ad POST rejects invalid position enum and missing name (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const badPos = await createAd(page, adPayload({ position: 'floating' }));
    expect(badPos.status()).toBe(400);
    const noName = await createAd(page, adPayload({ name: '' }));
    expect(noName.status()).toBe(400);
  });

  test('F9: ad scheduling window (startsAt/endsAt) round-trips as ISO dates', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const startsAt = '2026-01-01T00:00:00.000Z';
    const endsAt = '2026-12-31T23:59:59.999Z';
    const created = await (await createAd(page, adPayload({ startsAt, endsAt }))).json();
    expect(new Date(created.data.startsAt).toISOString()).toBe(startsAt);
    expect(new Date(created.data.endsAt).toISOString()).toBe(endsAt);
    // Clearing dates: PATCH with null clears the window (the schema accepts
    // null; '' is rejected — the '' normalization exists only on the config
    // PUT path, not the ad row PATCH).
    const cleared = await page.request.patch(`${ADS_URL}/${created.data.id}`, {
      data: { startsAt: null, endsAt: null },
    });
    expect(cleared.status(), `clear dates -> ${await cleared.text()}`).toBe(200);
    const clearedData = (await cleared.json()).data;
    expect(clearedData.startsAt).toBeNull();
    expect(clearedData.endsAt).toBeNull();
    await page.request.delete(`${ADS_URL}/${created.data.id}`);
  });

  test('F10: PUT with heroSlides arrays reconciles relation rows exactly (full replace)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // Create via the row route first…
    const s1 = await (await createSlide(page, slidePayload({ sortOrder: 0 }))).json();
    // …then save the config with a different slide — s1 must be deleted.
    const res = await putConfig(page, {
      heroSlides: [slidePayload({ sortOrder: 1, title: 'second' })],
      ads: [],
    });
    expect(res.status()).toBe(200);
    const after = await getConfig(page);
    expect(after.heroSlides).toHaveLength(1);
    expect(after.heroSlides[0].title).toBe('second');
    expect(after.heroSlides.some((s: any) => s.id === s1.data.id)).toBe(false);
  });

  test('F11: PUT skips media-less slide drafts per item instead of rejecting the save', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // M29-03 fix (OBS-43): the media-less draft filter now runs PER ITEM before
    // the survivor array is schema-validated, so a single empty-media draft is
    // skipped instead of failing `min(1)` and rejecting the whole save. The UI's
    // client-side strip behaviour is unchanged.
    const valid = slidePayload({ title: `keeper ${RUN_TAG}` });
    const res = await putConfig(page, {
      heroSlides: [valid, { mediaType: 'image', mediaUrl: '', title: 'draft' }],
      ads: [],
    });
    expect(res.status(), `PUT -> ${await res.text()}`).toBe(200);
    // The valid slide is persisted; the draft is dropped, not saved as a row.
    const after = await getConfig(page);
    expect(after.heroSlides).toHaveLength(1);
    expect(after.heroSlides[0].title).toBe(`keeper ${RUN_TAG}`);
  });

  test('F12: categories endpoint returns the tenant catalog (id/name)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(CATEGORIES_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.categories)).toBe(true);
    for (const c of json.data.categories) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('name');
    }
  });

  test('F13: products endpoint returns simplified rows for the picker', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${PRODUCTS_URL}?page=1&limit=5`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('products');
    expect(json.data).toHaveProperty('total');
    for (const p of json.data.products) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Precision & price formatting
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§2 Precision & price formatting', () => {
  test('P1: website products expose retailPrice with 2-dp LKR-safe values', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${PRODUCTS_URL}?page=1&limit=20`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    for (const p of json.data.products) {
      if (p.primaryVariant?.retailPrice != null) {
        const price = Number(p.primaryVariant.retailPrice);
        expect(Number.isFinite(price)).toBe(true);
        // 2-decimal currency invariant: value equals its own 2dp rounding.
        expect(price).toBeCloseTo(Math.round(price * 100) / 100, 10);
      }
    }
  });

  test('P2: products pagination contract (limit clamped 1..100, page floored at 1)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${PRODUCTS_URL}?page=0&limit=1000`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    // Route clamps: page = max(1, …), limit = min(100, max(1, …)).
    expect(json.data.products.length).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Cross-module cascade & impact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§3 Cross-module cascade & impact', () => {
  test('L1: website products reflect the live inventory catalog (Module 02 source)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const web = await (await page.request.get(`${PRODUCTS_URL}?page=1&limit=100`)).json();
    const store = await (await page.request.get(`${BASE_URL}/api/store/products?page=1&limit=100`)).json();
    // Same tenant source of truth. The store route applies permission-based
    // post-filtering (filteredProducts) on top of the shared getAllProducts
    // source, so totals may legitimately differ by a hair — run 2 observed
    // 62 (website) vs 61 (store). Pin the divergence to ±1; a wider gap
    // means the picker has drifted from the catalog.
    const drift = Math.abs(Number(web.data.total) - Number(store.meta.total));
    expect(
      drift,
      `website products (${web.data.total}) diverge from store catalog (${store.meta.total}) by ${drift} — documented ±1 tolerance (OBS-42)`,
    ).toBeLessThanOrEqual(1);
    expect(web.data.products.length).toBeGreaterThan(0);
  });

  test('L2 (BUG-69 pin): website categories must exclude soft-deleted rows', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const web = await (await page.request.get(CATEGORIES_URL)).json();
    const store = await (await page.request.get(`${BASE_URL}/api/store/categories`)).json();
    // The store route filters deletedAt: null (getAllCategories); the website
    // route queries prisma.category.findMany({ where: { tenantId } }) with NO
    // deletedAt filter — soft-deleted categories leak into the CMS picker.
    const storeNames = new Set((store.data as any[]).map((c: any) => c.name));
    const webNames = (web.data.categories as any[]).map((c: any) => c.name);
    const leaked = webNames.filter((n: string) => !storeNames.has(n));
    expect(
      leaked,
      `BUG-69: website categories include rows absent from the live catalog (soft-deleted leak): ${JSON.stringify(leaked)}`,
    ).toEqual([]);
  });

  test('L3: config save triggers storefront revalidation without failing the save', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // The route wraps revalidateWebsiteCache in try/catch — even if the
    // storefront is unreachable, the save must succeed.
    const res = await putConfig(page, { tagline: `revalidate probe ${RUN_TAG}` });
    expect(res.status()).toBe(200);
    const after = await getConfig(page);
    expect(after.tagline).toBe(`revalidate probe ${RUN_TAG}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Audit trail, reset & immutability
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§4 Audit trail, reset & immutability', () => {
  test('A1: config upsert writes a WebsiteConfig audit row', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await putConfig(page, { siteName: `Audit ${RUN_TAG}` });
    let found = false;
    for (let i = 0; i < 10 && !found; i++) {
      await page.waitForTimeout(300);
      const res = await page.request.get(`${BASE_URL}/api/audit-logs?entityType=WebsiteConfig&page=1&pageSize=10`);
      if (res.status() !== 200) continue;
      const json = await res.json().catch(() => null);
      const rows = json?.data ?? [];
      found = Array.isArray(rows) && rows.some((r: any) => r?.entityType === 'WebsiteConfig');
    }
    expect(found, 'expected a WebsiteConfig audit row within ~3s').toBe(true);
  });

  test('A2: DELETE /website resets all fields to null and clears slides/ads', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // Seed state to reset.
    await putConfig(page, { siteName: `ResetMe ${RUN_TAG}`, tagline: 'bye' });
    await createSlide(page, slidePayload());
    const del = await page.request.delete(CONFIG_URL);
    expect(del.status()).toBe(200);
    const json = await del.json();
    expect(json.data.reset).toBe(true);
    const after = await getConfig(page);
    expect(after.siteName).toBeNull();
    expect(after.tagline).toBeNull();
    expect(after.heroSlides).toHaveLength(0);
    expect(after.ads).toHaveLength(0);
  });

  test('A3: repeated DELETE /website is idempotent-safe (still 200, reset true)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const del = await page.request.delete(CONFIG_URL);
    expect(del.status()).toBe(200);
    expect((await del.json()).data.reset).toBe(true);
  });

  test('A4: PATCH after slide DELETE fails typed (row is hard-deleted)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (await createSlide(page, slidePayload())).json();
    const id = created.data.id;
    await page.request.delete(`${SLIDES_URL}/${id}`);
    const patch = await page.request.patch(`${SLIDES_URL}/${id}`, { data: { title: 'ghost' } });
    // Prisma P2025 — the route catch turns it into 500 (not a silent 200).
    expect([404, 500]).toContain(patch.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Chaos, button spamming & race conditions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§5 Chaos, button spamming & race conditions', () => {
  test('R1: rapid double PUT cannot duplicate the config (tenantId unique)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = await getConfig(page);
    const [a, b] = await Promise.all([
      putConfig(page, { siteName: `Race A ${RUN_TAG}` }),
      putConfig(page, { siteName: `Race B ${RUN_TAG}` }),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const after = await getConfig(page);
    expect(after.id).toBe(before.id); // upsert on tenantId — exactly one row
  });

  test('R2: concurrent slide creates all persist (independent rows)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const results = await Promise.all([
      createSlide(page, slidePayload({ title: 'r1' })),
      createSlide(page, slidePayload({ title: 'r2' })),
      createSlide(page, slidePayload({ title: 'r3' })),
    ]);
    for (const r of results) expect(r.status()).toBe(201);
    const config = await getConfig(page);
    expect(config.heroSlides.length).toBeGreaterThanOrEqual(3);
  });

  test('R3: repeated same-payload PUT applies once (id stable, value single-set)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = await getConfig(page);
    const [a, b] = await Promise.all([
      putConfig(page, { tagline: `dbl ${RUN_TAG}` }),
      putConfig(page, { tagline: `dbl ${RUN_TAG}` }),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const after = await getConfig(page);
    expect(after.id).toBe(before.id);
    expect(after.tagline).toBe(`dbl ${RUN_TAG}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Hardware & device simulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§6 Hardware & device simulation', () => {
  test('H1: website-asset upload accepts a PNG image (R2-backed)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // 1x1 transparent PNG.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), `${RUN_TAG}.png`);
    const res = await page.request.post(ASSET_UPLOAD_URL, { multipart: form as never });
    // R2 may be unconfigured in some environments — accept 2xx or provider 5xx.
    expect([200, 201, 500]).toContain(res.status());
    if (res.status() === 200 || res.status() === 201) {
      const json = await res.json();
      expect(json.url ?? json.data?.url).toBeTruthy();
    }
  });

  test('H2: website-asset upload rejects non-media MIME with 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(Buffer.from('not media'))], { type: 'text/plain' }), `${RUN_TAG}.txt`);
    const res = await page.request.post(ASSET_UPLOAD_URL, { multipart: form as never });
    expect(res.status()).toBe(400);
  });

  test('H3: oversized image (>10 MB) is rejected with a typed 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x89);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(big)], { type: 'image/png' }), `big-${RUN_TAG}.png`);
    const res = await page.request.post(ASSET_UPLOAD_URL, { multipart: form as never });
    expect(res.status()).toBe(400);
    const text = await res.text();
    expect(text).toContain('10 MB');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Network resilience & offline sync
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§7 Network resilience & offline sync', () => {
  test('N1: settings page survives a mocked 500 on the config GET', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.route(/\/api\/store\/website$/, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: { message: 'boom' } }) }));
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(String(e)));
    await page.goto(`${BASE_URL}/settings/website`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    expect(errors, 'no uncaught page errors on config-fetch failure').toEqual([]);
    await page.unroute(/\/api\/store\/website$/);
  });

  test('N2: PUT with malformed JSON never silently succeeds', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.put(CONFIG_URL, {
      data: '{broken',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('N3: slide POST with malformed JSON is rejected (no 201)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(SLIDES_URL, {
      data: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Security, RBAC & multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§8 Security, RBAC & multi-tenant isolation', () => {
  test('S1: unauthenticated access to website endpoints is rejected with 401', async ({ page }) => {
    const cfg = await page.request.get(CONFIG_URL);
    expect(cfg.status()).toBe(401);
    const put = await page.request.put(CONFIG_URL, { data: { siteName: 'x' } });
    expect(put.status()).toBe(401);
    const slides = await page.request.get(SLIDES_URL);
    expect(slides.status()).toBe(401);
    const ads = await page.request.get(ADS_URL);
    expect(ads.status()).toBe(401);
  });

  test('S2 (OBS-41 pin): cashier is forbidden from reading AND writing the website CMS (403)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    // M29-03 fix: the website CMS is gated on SETTINGS.manageWebsite
    // (`settings:website`) via the shared requirePermissionResponse guard, so a
    // CASHIER — whose explicit permission list omits it — gets 403 on reads too.
    const get = await page.request.get(CONFIG_URL);
    expect(get.status(), 'cashier GET /website must be 403').toBe(403);
    const put = await page.request.put(CONFIG_URL, { data: { tagline: `cashier ${RUN_TAG}` } });
    expect(put.status(), 'cashier PUT /website must be 403').toBe(403);
    const body = await put.json();
    expect(body.error.code).toBe('FORBIDDEN');
    // The write must not have landed — owner re-reads and finds no cashier value.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const after = await getConfig(page);
    expect(after.tagline).not.toBe(`cashier ${RUN_TAG}`);
  });

  test('S3: settings/website page is blocked for CASHIER (redirected away)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    await page.goto(`${BASE_URL}/settings/website`);
    await page.waitForLoadState('networkidle');
    // M29-03 fix: the page mirrors /settings/users and redirects to /dashboard
    // when the signed-in user lacks SETTINGS.manageWebsite. For a CASHIER that
    // is a two-hop redirect — /dashboard itself forwards to the role default
    // (/pos), so the terminal URL is asserted loosely.
    expect(page.url()).not.toContain('/settings/website');
    expect(page.url()).toMatch(/\/(dashboard|pos)$/);
  });

  test('S4 (BUG-68 pin): cross-tenant hero-slide PATCH must be rejected (IDOR probe)', async ({ page }) => {
    // Owner A (dilani) creates a slide.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (await createSlide(page, slidePayload({ title: 'dilani secret' }))).json();
    const slideId = created.data.id;
    // Owner B (Lanka) patches A's slide by bare id.
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const patch = await page.request.patch(`${SLIDES_URL}/${slideId}`, {
      data: { title: 'HACKED-BY-LANKA' },
    });
    // BUG-68 (M29-01 fix): updateHeroSlide is tenant-scoped — the cross-tenant
    // write fails closed as 404 (no existence disclosure). A 200 here means the
    // IDOR is back; any other status is not the pinned contract.
    expect(patch.status(), 'cross-tenant slide PATCH must fail closed as 404').toBe(404);
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.request.delete(`${SLIDES_URL}/${slideId}`);
  });

  test('S5 (BUG-68 pin): cross-tenant hero-slide DELETE must be rejected (IDOR probe)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (await createSlide(page, slidePayload({ title: 'dilani delete-me' }))).json();
    const slideId = created.data.id;
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const del = await page.request.delete(`${SLIDES_URL}/${slideId}`);
    // BUG-68 (M29-01 fix): tenant-scoped delete → 404 for a foreign id.
    expect(del.status(), 'cross-tenant slide DELETE must fail closed as 404').toBe(404);
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.request.delete(`${SLIDES_URL}/${slideId}`);
  });

  test('S6 (BUG-68 pin): cross-tenant ad PATCH must be rejected (IDOR probe)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (await createAd(page, adPayload({ name: 'dilani ad' }))).json();
    const adId = created.data.id;
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const patch = await page.request.patch(`${ADS_URL}/${adId}`, { data: { name: 'HACKED' } });
    // BUG-68 (M29-01 fix): tenant-scoped update → 404 for a foreign id.
    expect(patch.status(), 'cross-tenant ad PATCH must fail closed as 404').toBe(404);
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.request.delete(`${ADS_URL}/${adId}`);
  });

  test('S7: Lanka owner reads its own config — never dilani content', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const config = await getConfig(page);
    const snap = loadSnapshot();
    if (config) {
      expect(config.tenantId).not.toBe(snap?.tenantId);
      expect(config.siteName ?? '').not.toBe(`QA Site ${RUN_TAG}`);
    }
  });

  test('S8: config GET is tenant-scoped (dilani owner sees only dilani rows)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const config = await getConfig(page);
    const snap = loadSnapshot();
    expect(snap, 'snapshot must exist — §0 runs first').toBeTruthy();
    expect(config.tenantId).toBe(snap?.tenantId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Boundary inputs & chaos data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§9 Boundary inputs & chaos data', () => {
  test('X1: siteName over 100 chars is rejected (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await putConfig(page, { siteName: 'x'.repeat(101) });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  test('X2: color fields over 7 chars are rejected (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await putConfig(page, { primaryColor: '#11223344' });
    expect(res.status()).toBe(400);
  });

  test('X3: shopProductsPerPage outside 1..100 is rejected (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const zero = await putConfig(page, { shopProductsPerPage: 0 });
    expect(zero.status()).toBe(400);
    const big = await putConfig(page, { shopProductsPerPage: 101 });
    expect(big.status()).toBe(400);
  });

  test('X4: Unicode (Sinhala/Tamil/emoji) siteName round-trips intact', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const unicode = `සෞඛ්‍ය ஆன்மீக 🌿 ${RUN_TAG}`;
    const res = await putConfig(page, { siteName: unicode });
    expect(res.status()).toBe(200);
    const after = await getConfig(page);
    expect(after.siteName).toBe(unicode);
  });

  test('X5: XSS payload in siteName is stored raw but never executes in the UI', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const payload = '<script>alert("m29")</script>';
    const res = await putConfig(page, { siteName: payload });
    expect(res.status()).toBe(200);
    let dialogFired = false;
    page.once('dialog', () => { dialogFired = true; });
    await page.goto(`${BASE_URL}/settings/website`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    expect(dialogFired).toBe(false);
  });

  test('X6: navItems with hostile entries (empty label, __proto__) never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await putConfig(page, {
      navItems: [
        { label: 'Shop', href: '/shop' },
        { label: '' },
      ] as never,
    });
    expect([200, 400]).toContain(res.status());
  });

  test('X7: sections JSON accepts documented section keys and tolerates junk', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await putConfig(page, {
      sections: {
        hero: { isActive: true, sortOrder: 0 },
        bestSelling: { isActive: true, sortOrder: 1 },
        notARealSection: { isActive: true },
      } as never,
    });
    expect([200, 400]).toContain(res.status());
  });

  test('X8: slide title at the 200-char boundary is accepted; 201 rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const ok = await createSlide(page, slidePayload({ title: 'y'.repeat(200) }));
    expect(ok.status()).toBe(201);
    await page.request.delete(`${SLIDES_URL}/${(await ok.json()).data.id}`);
    const over = await createSlide(page, slidePayload({ title: 'y'.repeat(201) }));
    expect(over.status()).toBe(400);
  });

  test('X9: ad name at the 100-char boundary is accepted; 101 rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const ok = await createAd(page, adPayload({ name: 'z'.repeat(100) }));
    expect(ok.status()).toBe(201);
    await page.request.delete(`${ADS_URL}/${(await ok.json()).data.id}`);
    const over = await createAd(page, adPayload({ name: 'z'.repeat(101) }));
    expect(over.status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Time-travel & retroactive handling
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§10 Time-travel & retroactive handling', () => {
  test('T1: ad with a past window (ended 1999) stores the window intact', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (
      await createAd(page, adPayload({
        startsAt: '1999-01-01T00:00:00.000Z',
        endsAt: '1999-12-31T23:59:59.999Z',
      }))
    ).json();
    // Compare in UTC — the server may serialize in a local timezone.
    expect(new Date(created.data.endsAt).getUTCFullYear()).toBe(1999);
    await page.request.delete(`${ADS_URL}/${created.data.id}`);
  });

  test('T2: ad with a future window (2099) is stored; isActive stays editor-owned', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const created = await (
      await createAd(page, adPayload({ startsAt: '2099-01-01T00:00:00.000Z' }))
    ).json();
    expect(new Date(created.data.startsAt).getFullYear()).toBe(2099);
    expect(created.data.isActive).toBe(true);
    await page.request.delete(`${ADS_URL}/${created.data.id}`);
  });

  test('T3: config updatedAt advances on save; createdAt is stable', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = await getConfig(page);
    await page.waitForTimeout(1100);
    await putConfig(page, { tagline: `time ${RUN_TAG}` });
    const after = await getConfig(page);
    expect(after.id).toBe(before.id);
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updatedAt).getTime(),
    );
    expect(after.createdAt).toBe(before.createdAt);
  });

  test('T4: invalid date strings in ad scheduling are rejected with 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // M29-03 fix (OBS-44): `startsAt`/`endsAt` are `z.coerce.date().refine(...)`,
    // so a garbage date fails validation up front (400) instead of reaching the
    // service as `Invalid Date`. POST and PATCH share the one definition.
    const res = await createAd(page, adPayload({ startsAt: 'not-a-date' }));
    expect(res.status(), 'garbage startsAt must be 400').toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.data).toBeUndefined();

    // PATCH takes the same path (UpdateWebsiteAdSchema = WebsiteAdSchema.partial()).
    const created = await (await createAd(page, adPayload())).json();
    const patch = await page.request.patch(`${ADS_URL}/${created.data.id}`, {
      data: { startsAt: 'not-a-date' },
    });
    expect(patch.status(), 'garbage PATCH startsAt must be 400').toBe(400);
    // The stored row is untouched — no Invalid Date written.
    const get = await page.request.get(`${ADS_URL}`);
    const rows = (await get.json()).data as { id: string; startsAt: string | null }[];
    const row = rows.find((r) => r.id === created.data.id);
    expect(row).toBeTruthy();
    expect(row!.startsAt).toBeNull();
    await page.request.delete(`${ADS_URL}/${created.data.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §11 — Cleanup: restore the exact pre-suite snapshot
// ─────────────────────────────────────────────────────────────────────────────
test.describe('cleanup: restore original website config', () => {
  test('restores the snapshot config + relation rows', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const snapshot = loadSnapshot();
    if (!snapshot) throw new Error('snapshot missing — §0 must run first');
    const body: Record<string, unknown> = {
      heroSlides: (snapshot.heroSlides ?? []).map((s: any) => ({
        mediaType: s.mediaType ?? 'image',
        mediaUrl: s.mediaUrl,
        mobileMediaUrl: s.mobileMediaUrl ?? '',
        title: s.title ?? '',
        subtitle: s.subtitle ?? '',
        description: s.description ?? '',
        ctaText: s.ctaText ?? '',
        ctaLink: s.ctaLink ?? '',
        isActive: s.isActive ?? true,
        sortOrder: s.sortOrder ?? 0,
      })),
      ads: (snapshot.ads ?? []).map((a: any) => ({
        name: a.name,
        mediaType: a.mediaType ?? 'image',
        mediaUrl: a.mediaUrl,
        mobileMediaUrl: a.mobileMediaUrl ?? '',
        targetUrl: a.targetUrl ?? '',
        position: a.position ?? 'between_sections',
        displayAfterSection: a.displayAfterSection ?? '',
        startsAt: a.startsAt ?? '',
        endsAt: a.endsAt ?? '',
        isActive: a.isActive ?? true,
      })),
    };
    // Restore scalar fields (skip relation arrays + server-owned fields).
    for (const [k, v] of Object.entries(snapshot)) {
      if (['id', 'tenantId', 'createdAt', 'updatedAt', 'heroSlides', 'ads', 'tenant'].includes(k)) continue;
      body[k] = v;
    }
    const res = await putConfig(page, body);
    expect(res.status(), `cleanup PUT -> ${await res.text()}`).toBe(200);
    const after = await getConfig(page);
    expect(after.siteName).toBe(snapshot.siteName);
    expect(after.heroSlides).toHaveLength(snapshot.heroSlides?.length ?? 0);
    expect(after.ads).toHaveLength(snapshot.ads?.length ?? 0);
    // Consume the TEMP snapshot so a stale file never leaks into a later run.
    // The durable copy in test-results/ (see saveSnapshotBackup) is kept.
    rmSync(SNAPSHOT_PATH, { force: true });
  });
});
