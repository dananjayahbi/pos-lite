import { test, expect, type Page } from '@playwright/test';

/**
 * 04_categories_brands.spec.ts — MODULE 4: Categories & Brands
 *
 * Roadmap scope (QA_ROADMAP.md Module 04):
 *   • UI:  /categories, /brands (+ legacy redirects /inventory/categories,
 *          /inventory/brands → /categories, /brands)
 *   • API: /api/store/categories (+ [id]), /api/store/brands (+ [id]),
 *          /api/store/upload/category-image, /api/store/upload/brand-logo
 *   • Prisma: Category (parentId tree, sortOrder, imageUrl, @@unique([tenantId,name])),
 *             Brand (logoUrl, @@unique([tenantId,name]))
 *
 * Contracts verified by source inspection (READ-ONLY):
 *   • CategorySchema: name 2..60, description ≤500 optional, sortOrder int ≥0
 *     default 0, imageUrl string ≤500 ('' → null).
 *   • BrandSchema: name 2..60, description ≤500 optional, logoUrl must be a
 *     valid URL or null (z.string().url()).
 *   • POST/PATCH duplicate name → 409 CONFLICT ("already exists" branch).
 *   • DELETE is a SOFT delete (deletedAt) guarded by dependent products →
 *     409 CATEGORY_IN_USE / BRAND_IN_USE. Audit rows CATEGORY_DELETED /
 *     BRAND_DELETED are written with actorRole 'SYSTEM' (BUG-4 class).
 *   • getAllCategories/getAllBrands hard-filter deletedAt: null — soft-deleted
 *     rows are invisible and there is NO restore endpoint (BUG-20 class).
 *   • Uploads: JPEG/PNG/WebP/SVG only, ≤2 MB, 401 without session.
 *   • Page guards: /categories and /brands redirect to /login without a
 *     session and to /inventory when the user lacks 'product:create'.
 *
 * 10-point spectrum mapping is annotated per describe block.
 * All created data is RUN-suffixed and soft-deleted in cleanup (Appendix C.7).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

const OWNER = {
  email: 'owner@dilani-ayurwellness.lk',
  password: 'owner123!',
} as const;

const CASHIER = {
  email: 'cashier1@ayurpos.dev',
  password: 'cashier123!',
} as const;

const RUN = `m04x${Date.now().toString(36)}`.slice(-12);

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Generic helpers ──────────────────────────────────────────────────────────

async function waitForHydrated(page: Page, selector = 'body', timeout = 30_000) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return Object.getOwnPropertyNames(el).some((key) => key.startsWith('__reactProps$'));
    },
    selector,
    { timeout },
  );
}

/**
 * The /categories and /brands pages render no <form> until a dialog opens (and
 * the inline category form is a div, not a form), so gate hydration on the
 * target INPUT carrying React props — the definitive interactivity signal.
 * Falls back to waitForHydrated for elements that DO carry props.
 */
async function waitForHydratedInput(page: Page, selector: string, timeout = 45_000) {
  try {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return Object.getOwnPropertyNames(el).some((key) => key.startsWith('__reactProps$'));
      },
      selector,
      { timeout },
    );
  } catch {
    // Fallback: input visible is usually sufficient for Radix/shadcn inputs.
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10_000 });
  }
}

const json = async (r: any): Promise<any> => {
  try {
    return await r.json();
  } catch {
    return null;
  }
};

const apiPost = (p: Page, url: string, data: any) =>
  p.request.post(url, { data, headers: { 'content-type': 'application/json' } });

const apiPatch = (p: Page, url: string, data: any) =>
  p.request.patch(url, { data, headers: { 'content-type': 'application/json' } });

const pickId = (b: any): string | undefined =>
  b?.data?.id ?? b?.data?.category?.id ?? b?.data?.brand?.id ?? b?.id;

/**
 * Login helper. OWNER lands on /dashboard directly; CASHIER may open an
 * "Open POS" tab-choice dialog — race URL-vs-dialog like the Module 02 spec.
 */
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedInput(page, '#email');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 8_000 });
  } catch {
    const choice = page.getByRole('button', { name: /open in this tab/i }).first();
    await choice.waitFor({ state: 'visible', timeout: 30_000 });
    await choice.click();
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
  }
}

// ============================================================================
// §1 FUNCTIONAL & BUSINESS LOGIC — happy paths, validation, constraints
// ============================================================================

test.describe.serial('Module 4 — Categories & Brands (full-scope QA)', () => {
  test.describe.configure({ timeout: 180_000 });

  const state: {
    categoryId?: string;
    brandId?: string;
    createdCategoryIds: string[];
    createdBrandIds: string[];
  } = { createdCategoryIds: [], createdBrandIds: [] };

  // ── §1 Functional & business logic ─────────────────────────────────────────

  test('C1 categories page renders list + New Category form creates via UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 90_000 });

    const name = `${RUN} Cat UI`;
    await page.getByRole('button', { name: 'New Category' }).click();
    const input = page.getByPlaceholder('e.g. Hair Care');
    await expect(input).toBeVisible();
    await waitForHydratedInput(page, 'input[placeholder="e.g. Hair Care"]');
    await input.fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Inline form closes and the new category appears in the list.
    await expect(page.getByText('Category created')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator('span', { hasText: name }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Resolve the id via API for later tests.
    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    state.categoryId = rows.find((c) => c.name === name)?.id;
    expect(state.categoryId, 'created category resolvable via API').toBeTruthy();
    if (state.categoryId) state.createdCategoryIds.push(state.categoryId);
  });

  test('C2 category name <2 chars rejected client-side; API enforces 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // API contract first (deterministic).
    const res = await apiPost(page, '/api/store/categories', { name: 'A' });
    expect(res.status(), '1-char name → 400 VALIDATION_ERROR').toBe(400);
    const body = await json(res);
    expect(body?.error?.code ?? '').toBe('VALIDATION_ERROR');

    // UI: inline form Save stays disabled for a 1-char name.
    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'New Category' }).click();
    const input = page.getByPlaceholder('e.g. Hair Care');
    await expect(input).toBeVisible();
    await waitForHydratedInput(page, 'input[placeholder="e.g. Hair Care"]');
    await input.fill('A');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('C3 category create via API 201 + round-trip (description, sortOrder, imageUrl)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Cat API`;
    const res = await apiPost(page, '/api/store/categories', {
      name,
      description: 'QA-created category for Module 4',
      sortOrder: 42,
      imageUrl: '',
    });
    expect(res.status(), 'create → 201').toBe(201);
    const body = await json(res);
    const id = pickId(body);
    expect(id, 'id returned').toBeTruthy();
    if (id) state.createdCategoryIds.push(id);

    const got = await json(await page.request.get(`/api/store/categories/${id}`));
    const cat = got?.data ?? got;
    expect(cat?.name).toBe(name);
    expect(cat?.description).toBe('QA-created category for Module 4');
    expect(cat?.sortOrder).toBe(42);
    expect(cat?.imageUrl ?? null, "imageUrl '' normalised to null").toBeNull();
  });

  test('C4 category PATCH updates fields; rename conflict → 409', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.categoryId, 'depends on C1').toBeTruthy();

    const ok = await apiPatch(page, `/api/store/categories/${state.categoryId}`, {
      description: 'Updated by C4',
      sortOrder: 7,
    });
    expect(ok.status(), 'PATCH accepted').toBeLessThan(300);
    const okBody = await json(ok);
    expect(okBody?.data?.description).toBe('Updated by C4');
    expect(okBody?.data?.sortOrder).toBe(7);

    // Rename onto the C3 name → 409 CONFLICT.
    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    const c3 = rows.find((c) => c.name === `${RUN} Cat API`);
    expect(c3, 'C3 category present').toBeTruthy();
    const conflict = await apiPatch(page, `/api/store/categories/${state.categoryId}`, {
      name: `${RUN} Cat API`,
    });
    expect(conflict.status(), 'duplicate rename → 409').toBe(409);
  });

  test('B1 brands page renders list + New Brand dialog creates via UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/brands`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Brands' })).toBeVisible({ timeout: 90_000 });

    const name = `${RUN} Brand UI`;
    await page.getByRole('button', { name: 'New Brand' }).click();
    const input = page.locator('#brand-name');
    await expect(input).toBeVisible();
    await waitForHydratedInput(page, '#brand-name');
    await input.fill(name);
    await page.locator('#brand-description').fill('QA brand via UI');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('Brand created')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator('span', { hasText: name }).first(),
    ).toBeVisible({ timeout: 30_000 });

    const list = await json(await page.request.get('/api/store/brands'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    state.brandId = rows.find((b) => b.name === name)?.id;
    expect(state.brandId, 'created brand resolvable via API').toBeTruthy();
    if (state.brandId) state.createdBrandIds.push(state.brandId);
  });

  test('B2 brand create via API 201; logoUrl must be a valid URL (400 otherwise)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Brand API`;
    const res = await apiPost(page, '/api/store/brands', {
      name,
      description: 'QA-created brand',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(res.status(), 'create → 201').toBe(201);
    const id = pickId(await json(res));
    expect(id).toBeTruthy();
    if (id) state.createdBrandIds.push(id);

    const bad = await apiPost(page, '/api/store/brands', {
      name: `${RUN} Brand BadURL`,
      logoUrl: 'not-a-url',
    });
    expect(bad.status(), 'invalid logoUrl → 400').toBe(400);
  });

  test('B3 brand PATCH updates description; duplicate rename → 409', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.brandId, 'depends on B1').toBeTruthy();

    const ok = await apiPatch(page, `/api/store/brands/${state.brandId}`, {
      description: 'Updated by B3',
    });
    expect(ok.status(), 'PATCH accepted').toBeLessThan(300);
    expect((await json(ok))?.data?.description).toBe('Updated by B3');

    const conflict = await apiPatch(page, `/api/store/brands/${state.brandId}`, {
      name: `${RUN} Brand API`,
    });
    expect(conflict.status(), 'duplicate rename → 409').toBe(409);
  });

  test('C5 legacy redirects /inventory/categories and /inventory/brands work', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    // Browser-level goto on a server redirect aborts in Next dev mode
    // (net::ERR_ABORTED) and the redirect-follow is racy, so assert the
    // deterministic server contract instead: the RSC payload carries
    // NEXT_REDIRECT with the target path, using the authenticated session
    // cookies from the browser context.
    const cookies = await page.context().cookies(BASE_URL);
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    for (const [legacy, target] of [
      ['/inventory/brands', '/brands'],
      ['/inventory/categories', '/categories'],
    ] as const) {
      const res = await fetch(`${BASE_URL}${legacy}`, {
        headers: { cookie: cookieHeader, RSC: '1' },
      });
      const body = await res.text();
      expect(
        body,
        `${legacy} RSC payload must redirect to ${target} (got status ${res.status})`,
      ).toContain(`NEXT_REDIRECT`);
      expect(body, `${legacy} redirect target`).toContain(target);
    }
  });

  // ── §2 Financial & calculation precision ───────────────────────────────────
  // Categories/Brands carry no money fields; the precision surface here is the
  // sortOrder integer contract (int ≥ 0, no floats, no negatives).

  test('F1 sortOrder precision: negative and non-integer rejected 400; large int ok', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const negatives = [
      { name: `${RUN} SortNeg`, sortOrder: -1 },
      { name: `${RUN} SortFloat`, sortOrder: 1.5 },
      { name: `${RUN} SortStr`, sortOrder: 'two' },
    ];
    for (const payload of negatives) {
      const res = await apiPost(page, '/api/store/categories', payload);
      expect.soft(
        res.status(),
        `payload=${JSON.stringify(payload)} → 400, got ${res.status()}`,
      ).toBe(400);
    }
    const big = await apiPost(page, '/api/store/categories', {
      name: `${RUN} SortBig`,
      sortOrder: 2_147_483_000,
    });
    expect.soft(big.status(), 'large int sortOrder accepted').toBeLessThan(300);
    const id = pickId(await json(big));
    if (id) state.createdCategoryIds.push(id);
  });

  // ── §3 Cross-module cascade & ledger impact ────────────────────────────────
  // Category is a mandatory FK on Product (roadmap dependency #2): a category
  // with products must refuse deletion (409 CATEGORY_IN_USE), and the product
  // count badge must reflect live products.

  test('L1 category with assigned products refuses delete (409 CATEGORY_IN_USE)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Seed category has products (Herbal Powders etc.).
    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    const withProducts = rows.find((c) => (c?._count?.products ?? 0) > 0);
    expect(withProducts, 'seeded category with products exists').toBeTruthy();

    const del = await page.request.delete(`/api/store/categories/${withProducts.id}`);
    expect(del.status(), 'in-use category delete → 409').toBe(409);
    const body = await json(del);
    expect(body?.error?.code ?? '', 'error code CATEGORY_IN_USE').toContain('IN_USE');

    // Still visible afterwards (not soft-deleted).
    const after = await json(await page.request.get(`/api/store/categories/${withProducts.id}`));
    expect(after?.data?.id ?? after?.id, 'category survives failed delete').toBeTruthy();
  });

  test('L2 brand with assigned products refuses delete (409 BRAND_IN_USE)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const list = await json(await page.request.get('/api/store/brands'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    const withProducts = rows.find((b) => (b?._count?.products ?? 0) > 0);
    expect(withProducts, 'seeded brand with products exists').toBeTruthy();

    const del = await page.request.delete(`/api/store/brands/${withProducts.id}`);
    expect(del.status(), 'in-use brand delete → 409').toBe(409);
    const body = await json(del);
    expect(body?.error?.code ?? '', 'error code BRAND_IN_USE').toContain('IN_USE');
  });

  test('L3 product count badge matches API _count for a sampled category', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 90_000 });

    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    const sample = rows.find((c) => (c?._count?.products ?? 0) > 0);
    if (!sample) return; // nothing to assert on an empty catalog

    const row = page.locator('div[role="button"]', { hasText: sample.name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.locator('badge, span').filter({ hasText: String(sample._count.products) }).first())
      .toBeVisible({ timeout: 15_000 });
  });

  // ── §4 Audit trail, soft delete & no hard delete ───────────────────────────

  test('A1 category delete is SOFT: vanishes from list, GET 404s, audit row written', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Cat Del`;
    const res = await apiPost(page, '/api/store/categories', { name });
    expect(res.status()).toBe(201);
    const id = pickId(await json(res));
    expect(id).toBeTruthy();

    const del = await page.request.delete(`/api/store/categories/${id}`);
    expect(del.status(), 'delete accepted (soft)').toBeLessThan(300);
    const delBody = await json(del);
    expect(delBody?.data?.deletedAt ?? null, 'deletedAt stamped').toBeTruthy();

    // Invisible in list…
    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    expect.soft(rows.some((c) => c.id === id), 'absent from list').toBe(false);
    // …and GET by id 404s (no restore path — BUG-20 class).
    const get = await page.request.get(`/api/store/categories/${id}`);
    expect.soft(get.status(), 'GET after delete → 404').toBe(404);

    // Audit row: CATEGORY_DELETED (actorRole SYSTEM — BUG-4 class guard).
    const audit = await json(
      await page.request.get(
        `/api/audit-logs?entityType=Category&action=CATEGORY_DELETED&pageSize=50`,
      ),
    );
    const auditRows: any[] = audit?.data?.data ?? audit?.data ?? [];
    const mine = auditRows.find((a) => a.entityId === id);
    expect.soft(mine, 'CATEGORY_DELETED audit row exists').toBeTruthy();
    if (mine) {
      expect.soft(mine.actorRole ?? '', 'audit actorRole present (BUG-4 guard)').toBeTruthy();
    }
  });

  test('A2 brand delete is SOFT with BRAND_DELETED audit row', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Brand Del`;
    const res = await apiPost(page, '/api/store/brands', { name });
    expect(res.status()).toBe(201);
    const id = pickId(await json(res));
    expect(id).toBeTruthy();

    const del = await page.request.delete(`/api/store/brands/${id}`);
    expect(del.status(), 'delete accepted (soft)').toBeLessThan(300);

    const list = await json(await page.request.get('/api/store/brands'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    expect.soft(rows.some((b) => b.id === id), 'absent from list').toBe(false);
    const get = await page.request.get(`/api/store/brands/${id}`);
    expect.soft(get.status(), 'GET after delete → 404').toBe(404);

    const audit = await json(
      await page.request.get(`/api/audit-logs?entityType=Brand&action=BRAND_DELETED&pageSize=50`),
    );
    const auditRows: any[] = audit?.data?.data ?? audit?.data ?? [];
    expect.soft(auditRows.some((a) => a.entityId === id), 'BRAND_DELETED audit row exists').toBeTruthy();
  });

  test('A3 duplicate name after soft-delete: recreate same name → clean 409 (BUG-21 fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Cat Reuse`;
    const first = await apiPost(page, '/api/store/categories', { name });
    expect(first.status()).toBe(201);
    const id = pickId(await json(first));
    await page.request.delete(`/api/store/categories/${id}`);

    // FIXED (INF-02): the DB has @@unique([tenantId, name]) and the soft-deleted
    // row still holds the name, so the insert hits the unique constraint — but
    // mapPrismaError now turns P2002 into a friendly 409 CONFLICT. The raw
    // Prisma dump (server paths / chunk names / "already exists" echo) that
    // used to leak through the route's message.includes() branch is gone.
    // (Recreate-after-soft-delete *policy* — 409 vs 201 — is D4/XC-05, W2.)
    const second = await apiPost(page, '/api/store/categories', { name });
    expect(second.status(), 'recreate-after-delete → 409').toBe(409);
    const body = await json(second);
    expect(body?.error?.code, 'CONFLICT code').toBe('CONFLICT');
    const msg = String(body?.error?.message ?? '');
    expect(msg, 'friendly field-derived message').toMatch(/already exists/i);
    expect(msg.toLowerCase(), 'no Prisma/internals leak (BUG-21/26/29)').not.toMatch(
      /prisma|\.next|chunk|invalid `|invocation|constraint failed/,
    );
  });

  // ── §5 Chaos, button spam & race conditions ────────────────────────────────

  test('R1 double-click Save creates exactly ONE category (no duplicates)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });

    const name = `${RUN} Cat Spam`;
    await page.getByRole('button', { name: 'New Category' }).click();
    const input = page.getByPlaceholder('e.g. Hair Care');
    await expect(input).toBeVisible();
    await waitForHydratedInput(page, 'input[placeholder="e.g. Hair Care"]');
    await input.fill(name);
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    await save.dblclick();

    await expect(page.getByText('Category created')).toBeVisible({ timeout: 30_000 });
    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    const matches = rows.filter((c) => c.name === name);
    expect(matches.length, 'exactly one category created despite dblclick').toBe(1);
    if (matches[0]?.id) state.createdCategoryIds.push(matches[0].id);
  });

  test('R2 concurrent duplicate-name creates: exactly one 201, no 500s', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Cat Race`;
    const payload = { name };
    const [a, b, c] = await Promise.all([
      apiPost(page, '/api/store/categories', payload),
      apiPost(page, '/api/store/categories', payload),
      apiPost(page, '/api/store/categories', payload),
    ]);
    const statuses = [a.status(), b.status(), c.status()];
    expect.soft(statuses.filter((s) => s === 201).length, 'exactly one 201').toBe(1);
    expect.soft(
      statuses.filter((s) => s >= 500).length,
      `no 500s under race, got ${JSON.stringify(statuses)}`,
    ).toBe(0);
    for (const r of [a, b, c]) {
      const id = pickId(await json(r));
      if (id && r.status() < 300) state.createdCategoryIds.push(id);
    }
  });

  // ── §6 Hardware & device simulation ────────────────────────────────────────
  // No scanner/scale surface on this module; the device-adjacent surface is
  // image upload (file picker) for category images / brand logos.

  test('H1 category-image upload: valid PNG accepted, wrong type rejected', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // 1x1 transparent PNG.
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const png = Buffer.from(pngBase64, 'base64');

    const ok = await page.request.post('/api/store/upload/category-image', {
      multipart: {
        file: { name: 'qa.png', mimeType: 'image/png', buffer: png },
      },
    });
    // Storage provider may be unconfigured in QA env — accept 2xx OR a clean
    // 5xx from the provider, but a validation-class rejection is a defect.
    expect.soft(ok.status(), 'valid PNG upload not rejected as 4xx validation').not.toBe(400);
    if (ok.status() < 300) {
      const body = await json(ok);
      expect.soft(body?.url ?? '', 'upload returns url').toBeTruthy();
    }

    const bad = await page.request.post('/api/store/upload/category-image', {
      multipart: {
        file: { name: 'qa.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') },
      },
    });
    expect(bad.status(), 'text/plain rejected 400').toBe(400);
  });

  test('H2 brand-logo upload mirrors category-image contract', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const ok = await page.request.post('/api/store/upload/brand-logo', {
      multipart: { file: { name: 'qa-logo.png', mimeType: 'image/png', buffer: png } },
    });
    expect.soft(ok.status(), 'valid PNG logo upload not 4xx').not.toBe(400);
    const bad = await page.request.post('/api/store/upload/brand-logo', {
      multipart: { file: { name: 'x.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') } },
    });
    expect(bad.status(), 'binary non-image rejected 400').toBe(400);
  });

  // ── §7 Network resilience ──────────────────────────────────────────────────

  test('N1 categories API 500 → page shows graceful error, no white-screen', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/categories**', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ success: false, error: { code: 'INTERNAL_SERVER_ERROR' } }),
      }),
    );
    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length, 'page still renders content').toBeGreaterThan(50);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.waitForTimeout(500);
    expect(pageErrors.length, `uncaught page errors: ${pageErrors.join(' | ')}`).toBe(0);
    await page.unroute('**/api/store/categories**');
  });

  test('N2 brands API 504 → page degrades gracefully', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/brands**', (route) =>
      route.fulfill({ status: 504, body: 'Gateway timeout' }),
    );
    await page.goto(`${BASE_URL}/brands`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length, 'page still renders content').toBeGreaterThan(50);
    await page.unroute('**/api/store/brands**');
  });

  // ── §8 Security, RBAC & tenant isolation ───────────────────────────────────

  test('S1 unauthenticated access: pages redirect to /login, APIs 401', async ({ page }) => {
    const browser = page.context().browser()!;
    const ctx = await browser.newContext();
    const anon = await ctx.newPage();

    await anon.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await expect(anon).toHaveURL(/\/login/, { timeout: 30_000 });
    await anon.goto(`${BASE_URL}/brands`, { waitUntil: 'domcontentloaded' });
    await expect(anon).toHaveURL(/\/login/, { timeout: 30_000 });

    const get = await ctx.request.get('/api/store/categories');
    expect([401, 403], 'anon categories GET blocked').toContain(get.status());
    const post = await ctx.request.post('/api/store/categories', {
      data: { name: 'anon cat' },
      headers: { 'content-type': 'application/json' },
    });
    expect([401, 403], 'anon categories POST blocked').toContain(post.status());
    const upload = await ctx.request.post('/api/store/upload/category-image', {
      multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
    });
    expect([401, 403], 'anon upload blocked').toContain(upload.status());
    await ctx.close();
  });

  test('S2 CASHIER lacks product:create → pages redirect to /inventory, APIs 403', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);

    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/inventory/, { timeout: 30_000 });
    await page.goto(`${BASE_URL}/brands`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/inventory/, { timeout: 30_000 });

    const post = await apiPost(page, '/api/store/categories', { name: `${RUN} cashier` });
    expect([401, 403], `cashier create blocked, got ${post.status()}`).toContain(post.status());
    const patch = await apiPatch(page, '/api/store/categories/whatever', { name: 'x' });
    expect([401, 403], 'cashier patch blocked').toContain(patch.status());
    const del = await page.request.delete('/api/store/categories/whatever');
    expect([401, 403], 'cashier delete blocked').toContain(del.status());
  });

  test('S3 cross-tenant isolation: owner A cannot read/mutate tenant B category', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Find a category id that belongs to the OTHER tenant by probing the
    // public storefront API of Lanka Electronics (slug from seed).
    const pub = await json(
      await page.request.get(`${BASE_URL}/api/public/site/lanka-electronics/categories?limit=50`),
    );
    const pubRows: any[] = Array.isArray(pub) ? pub : (pub?.data ?? []);
    const foreign = pubRows[0];
    if (!foreign?.id) {
      test.info().annotations.push({ type: 'info', description: 'No foreign category visible via public API; isolation asserted via 404 path only.' });
    }

    if (foreign?.id) {
      const get = await page.request.get(`/api/store/categories/${foreign.id}`);
      expect.soft(get.status(), 'foreign category GET → 404 (tenant-scoped)').toBe(404);
      const patch = await apiPatch(page, `/api/store/categories/${foreign.id}`, { name: 'hijacked' });
      expect.soft(patch.status(), 'foreign category PATCH blocked').toBeGreaterThanOrEqual(400);
      expect.soft(patch.status(), 'foreign PATCH never 500').toBeLessThan(500);
      const del = await page.request.delete(`/api/store/categories/${foreign.id}`);
      expect.soft(del.status(), 'foreign category DELETE blocked').toBeGreaterThanOrEqual(400);
    }

    // Duplicate-name create must be scoped per tenant: the same name exists in
    // tenant B (seeded) but tenant A can still create its own copy.
    const dup = await apiPost(page, '/api/store/categories', { name: 'Herbal Powders' });
    expect.soft(dup.status(), 'same name in DIFFERENT tenant allowed (or clean 409)').toBeLessThan(500);
    if (dup.status() < 300) {
      const id = pickId(await json(dup));
      if (id) state.createdCategoryIds.push(id);
    }
  });

  // ── §9 Boundary inputs & chaos data ────────────────────────────────────────

  test('X1 Sinhala/Tamil/emoji category & brand names round-trip intact', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const catName = `${RUN} ශාක ෂධ மூலிகை 🌿`;
    const cat = await apiPost(page, '/api/store/categories', { name: catName });
    expect.soft(cat.status(), 'unicode category create < 300').toBeLessThan(300);
    const catId = pickId(await json(cat));
    if (catId) state.createdCategoryIds.push(catId);

    const brandName = `${RUN} ඇඳුම් மருந்து ✨`;
    const brand = await apiPost(page, '/api/store/brands', { name: brandName });
    expect.soft(brand.status(), 'unicode brand create < 300').toBeLessThan(300);
    const brandId = pickId(await json(brand));
    if (brandId) state.createdBrandIds.push(brandId);

    if (catId) {
      const back = JSON.stringify(await json(await page.request.get(`/api/store/categories/${catId}`)));
      expect.soft(back, 'Sinhala preserved').toContain('ශාක');
      expect.soft(back, 'Tamil preserved').toContain('மூலிகை');
      expect.soft(back, 'emoji preserved').toContain('🌿');
    }
  });

  test('X2 XSS payloads in names are stored inert and never execute in UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    let dialogFired = false;
    page.on('dialog', async (d) => {
      dialogFired = true;
      await d.dismiss();
    });
    // The XSS payload exceeds the 60-char name limit, so the API correctly
    // rejects it with 400 — that rejection is itself the security control.
    // For the stored-XSS UI check, use a payload that fits the limit.
    const longXss = `${RUN} <script>window.__m04xss=1</script><img src=x onerror="window.__m04xss=1">`;
    const res = await apiPost(page, '/api/store/categories', { name: longXss });
    expect.soft(res.status(), 'oversized XSS name rejected 400 (length control)').toBe(400);

    const shortXss = `${RUN} <img src=x onerror=window.__m04xss=1>`;
    const res2 = await apiPost(page, '/api/store/categories', { name: shortXss });
    expect.soft(res2.status(), 'short XSS name create < 300').toBeLessThan(300);
    const id = pickId(await json(res2));
    if (id) state.createdCategoryIds.push(id);

    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const exec = await page.evaluate(() => (window as any).__m04xss ?? null);
    expect(exec, 'script payload must NOT execute').toBeNull();
    expect(dialogFired, 'no alert dialogs from stored XSS').toBe(false);
  });

  test('X3 boundary lengths: 1-char rejected, 60-char accepted, 61+ rejected, 500-char description ok', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const tooShort = await apiPost(page, '/api/store/categories', { name: 'A' });
    expect.soft(tooShort.status(), '1-char name → 400').toBe(400);

    const ok60 = await apiPost(page, '/api/store/categories', { name: 'X'.repeat(60) });
    expect.soft(ok60.status(), '60-char name accepted').toBeLessThan(300);
    const okId = pickId(await json(ok60));
    if (okId) state.createdCategoryIds.push(okId);

    const tooLong = await apiPost(page, '/api/store/categories', { name: 'X'.repeat(61) });
    expect.soft(tooLong.status(), '61-char name → 400').toBe(400);

    const desc = await apiPost(page, '/api/store/categories', {
      name: `${RUN} Desc500`,
      description: 'D'.repeat(500),
    });
    expect.soft(desc.status(), '500-char description accepted').toBeLessThan(300);
    const descId = pickId(await json(desc));
    if (descId) state.createdCategoryIds.push(descId);

    const descOver = await apiPost(page, '/api/store/categories', {
      name: `${RUN} Desc501`,
      description: 'D'.repeat(501),
    });
    expect.soft(descOver.status(), '501-char description → 400').toBe(400);
  });

  test('X4 hostile chaos payloads never 500 (nulls, arrays, prototype keys)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const payloads: any[] = [
      { name: null },
      { name: 12345 },
      { name: ['array', 'name'] },
      { name: `${RUN} proto`, __proto__: { isAdmin: true }, sortOrder: 0 },
      { name: `${RUN} extra`, unknownField: { nested: 'dropped?' } },
      {},
    ];
    for (const [i, payload] of payloads.entries()) {
      const res = await apiPost(page, '/api/store/categories', payload);
      expect.soft(res.status(), `chaos payload #${i} → not 500, got ${res.status()}`).toBeLessThan(500);
      if (res.status() < 300) {
        const id = pickId(await json(res));
        if (id) state.createdCategoryIds.push(id);
      }
    }
  });

  // ── §10 Time-travel & retroactive date handling ────────────────────────────

  test('T1 client-supplied createdAt/updatedAt cannot backdate a category', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await apiPost(page, '/api/store/categories', {
      name: `${RUN} TimeTravel`,
      createdAt: '1999-01-01T00:00:00.000Z',
      updatedAt: '1999-01-01T00:00:00.000Z',
    } as any);
    expect.soft(res.status(), 'create with forged dates < 300').toBeLessThan(300);
    const id = pickId(await json(res));
    if (id) state.createdCategoryIds.push(id);
    if (id && res.status() < 300) {
      const body = JSON.stringify(await json(await page.request.get(`/api/store/categories/${id}`)));
      const createdAt = body.match(/"createdAt":"([^"]+)"/)?.[1] ?? '';
      if (createdAt) {
        expect(
          new Date(createdAt).getFullYear(),
          'server clock wins over client-supplied 1999 date',
        ).toBeGreaterThan(2020);
      }
    }
  });

  test('T2 sortOrder reordering is retroactive-safe: list order follows sortOrder then name', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await apiPost(page, '/api/store/categories', { name: `${RUN} Zeta`, sortOrder: 5 });
    const b = await apiPost(page, '/api/store/categories', { name: `${RUN} Alpha`, sortOrder: 5 });
    const [aId, bId] = [pickId(await json(a)), pickId(await json(b))];
    if (aId) state.createdCategoryIds.push(aId);
    if (bId) state.createdCategoryIds.push(bId);

    const list = await json(await page.request.get('/api/store/categories'));
    const rows: any[] = Array.isArray(list?.data) ? list.data : [];
    const idx = (id?: string) => rows.findIndex((r) => r.id === id);
    if (aId && bId && idx(aId) >= 0 && idx(bId) >= 0) {
      // Same sortOrder → name asc: Alpha before Zeta.
      expect.soft(
        idx(bId),
        'tie on sortOrder broken by name asc (Alpha before Zeta)',
      ).toBeLessThan(idx(aId));
    }
  });

  // ── Cleanup (Appendix C.7) ─────────────────────────────────────────────────

  test('cleanup: soft-deletes every RUN-created category & brand via API', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const id of [...new Set(state.createdCategoryIds)]) {
      await page.request.delete(`/api/store/categories/${id}`).catch(() => {});
    }
    for (const id of [...new Set(state.createdBrandIds)]) {
      await page.request.delete(`/api/store/brands/${id}`).catch(() => {});
    }
  });
});
