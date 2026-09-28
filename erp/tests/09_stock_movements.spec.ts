import { test, expect, type Page } from '@playwright/test';

/**
 * 09_stock_movements.spec.ts — MODULE 9: Stock Movements & Adjustments
 *
 * Roadmap scope (QA_ROADMAP.md Module 09):
 *   • UI:  /stock-control (dashboard: KPI cards + recent activity),
 *          /stock-control/adjust (manual adjustment form + variant prefill),
 *          /stock-control/movements (filterable ledger + CSV export),
 *          /stock-control/low-stock (reorder list + CSV export)
 *   • API: /api/store/stock-control/adjust (POST),
 *          .../bulk-adjust (POST, atomic ≤50),
 *          .../movements (GET paginated + format=csv),
 *          .../recent-movements (GET top-10),
 *          .../summary (GET KPIs),
 *          .../actors (GET distinct actors),
 *          .../variant-lookup?variantId (GET prefill),
 *          .../low-stock (GET rows/countOnly/format=csv),
 *          /api/store/products/[id]/movements (GET per-product ledger)
 *   • Prisma: StockMovement (immutable ledger: reason, quantityDelta,
 *             quantityBefore/After, actorId, note), ProductVariant
 *             (stockQuantity, lowStockThreshold), enum StockMovementReason
 *
 * Contracts verified by source inspection (READ-ONLY):
 *   • StockAdjustmentSchema: variantId cuid, quantityDelta int, ≠0 and
 *     |delta| ≤ 1,000,000 enforced at schema level (M09-02/M09-03 —
 *     zero-delta and INT_MAX-scale values are typed 400s), reason
 *     nativeEnum, note ≤500 optional.
 *   • adjust POST: 401 unauth / 403 no stock:adjust / 400 VALIDATION_ERROR /
 *     404 NOT_FOUND (variant of another tenant or soft-deleted) / 400
 *     'Stock cannot go below zero' / 200 {quantityBefore, quantityAfter,
 *     movement, lowStockTriggered, productName, sku}. Writes the ledger row
 *     inside a transaction with the variant increment.
 *   • bulk-adjust POST: 1..50 adjustments, dedupes variant ids for the
 *     pre-check, atomic $transaction (BELOW_ZERO → 422 BELOW_ZERO_STOCK with
 *     SKU + current stock, whole batch rolled back), in-batch sequential
 *     deltas on the same variant are supported, lowStockTriggeredVariantIds
 *     returned.
 *   • movements GET: page/limit (1..100), from/to, reasons (validated against
 *     the enum — invalid tokens silently dropped), search (sku/product name,
 *     insensitive), actorId, sortOrder asc|desc, format=csv (attachment).
 *   • summary GET: totalProducts (live, unarchived), lowStockVariants
 *     (raw SQL stockQuantity <= lowStockThreshold), pendingStockTakes
 *     (PENDING_APPROVAL), totalStockValue = Σ(stockQuantity × retailPrice)
 *     gated behind product:view_cost_price (null otherwise).
 *   • actors GET: distinct actorIds from movements → user emails.
 *   • variant-lookup GET: 400 missing variantId, 404 unknown/cross-tenant,
 *     returns variant + product for the Low-Stock prefill flow.
 *   • low-stock GET: raw SQL join, shortfall = threshold − stock, ORDER BY
 *     shortfall DESC, countOnly/format=csv/threshold override params.
 *   • Seed truth: tenant 'dilani' has a 10-product Ayurveda catalog with
 *     variants (threshold 5, ~15% seeded low) and INITIAL_STOCK movements
 *     (~30 days ago, actor = OWNER). Tenant 2 (lanka-electronics) has NO
 *     catalog — its ledger is empty.
 *
 * 10-point spectrum mapping is annotated per describe block.
 * All mutations are net-zero: every +N is reverted with −N (or vice versa)
 * and verified back to the F0 snapshot quantity in cleanup.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

const OWNER = {
  email: 'owner@dilani-ayurwellness.lk',
  password: 'owner123!',
} as const;

const OWNER_TENANT2 = {
  email: 'owner@lanka-electronics.lk',
  password: 'owner123!',
} as const;

const CASHIER = {
  email: 'cashier1@ayurpos.dev',
  password: 'cashier123!',
} as const;

const RUN = `m09x${Date.now().toString(36)}`.slice(-12);

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Generic helpers ──────────────────────────────────────────────────────────

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

/**
 * Login helper. OWNER lands on /dashboard; CASHIER may open an "Open POS"
 * tab-choice dialog — race URL-vs-dialog like the Module 02–08 specs.
 */
async function login(page: Page, email: string, password: string) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedInput(page, '#email');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 8_000 });
  } catch {
    const choice = page.getByRole('button', { name: /open in this tab/i }).first();
    try {
     await choice.waitFor({ state: 'visible', timeout: 15_000 });
     await choice.click();
   } catch {
     /* slow cold-compile sign-in for a non-cashier role — no dialog; *
      * the trailing URL check below resolves the race. */
   }
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
  }
}

/** Navigate to a stock-control page with cold-route resilience (dev compile). */
async function gotoStockPage(page: Page, path: string, heading: string | RegExp) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  try {
    await expect(
      typeof heading === 'string'
        ? page.getByRole('heading', { name: heading })
        : page.getByRole('heading', { name: heading }),
    ).toBeVisible({ timeout: 20_000 });
  } catch {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await expect(
      typeof heading === 'string'
        ? page.getByRole('heading', { name: heading })
        : page.getByRole('heading', { name: heading }),
    ).toBeVisible({ timeout: 60_000 });
  }
}

/** Pick a variant with stock ≥ minStock (default 10) from the seeded catalog. */
async function pickVariant(page: Page, minStock = 10, skip = 0): Promise<any> {
  const res = await page.request.get('/api/store/products?limit=100');
  expect(res.status(), 'product list reachable').toBe(200);
  const body = await json(res);
  const products: any[] = Array.isArray(body?.data) ? body.data : body?.data?.products ?? [];
  const matches: any[] = [];
  for (const p of products) {
    let variants = p?.variants;
    if (!variants) {
      const detail = await json(await page.request.get(`/api/store/products/${p.id}`));
      variants = detail?.data?.variants ?? [];
    }
    for (const v of variants ?? []) {
      if ((v.stockQuantity ?? 0) >= minStock) matches.push({ product: p, variant: v });
    }
  }
  const pick = matches[skip];
  if (!pick) throw new Error(`No variant #${skip + 1} with stock ≥ ${minStock} found`);
  return pick;
}

/** Apply an adjustment via the API and assert 200. */
async function adjust(
  page: Page,
  variantId: string,
  quantityDelta: number,
  reason: string,
  note?: string,
) {
  const res = await apiPost(page, '/api/store/stock-control/adjust', {
    variantId,
    quantityDelta,
    reason,
    ...(note !== undefined ? { note } : {}),
  });
  const body = await json(res);
  return { status: res.status() as number, body };
}

/** Read the live variant row (stockQuantity + threshold). */
async function getVariant(page: Page, variantId: string): Promise<any> {
  const res = await page.request.get(`/api/store/stock-control/variant-lookup?variantId=${variantId}`);
  expect(res.status(), 'variant-lookup 200').toBe(200);
  return (await json(res))?.data?.variant;
}

/**
 * Select the fixture variant when the product is ALREADY chosen (product chip
 * visible, search input replaced). The variant combobox only mounts AFTER the
 * product's variants finish loading, and the reason combobox below it is also
 * a combobox — so filter the trigger on its 'Select variant' placeholder text.
 */
async function selectVariantOnly(page: Page, variantSku: string) {
  const trigger = page.getByRole('combobox').filter({ hasText: 'Select variant' }).first();
  await trigger.waitFor({ state: 'visible', timeout: 30_000 });
  await trigger.click();
  await page.getByRole('option').filter({ hasText: variantSku }).first().click();

  // Selected value rendered into the trigger.
  await expect(page.getByRole('combobox').filter({ hasText: variantSku }).first()).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Select the fixture variant in the adjust form. The variant combobox only
 * mounts AFTER the product's variants finish loading (until then the slot
 * shows a spinner), and the reason combobox below it is also a combobox —
 * so wait for the trigger to carry the fixture SKU (Radix renders the
 * selected value into the trigger) before touching anything else.
 */
async function selectFixtureVariant(page: Page, productName: string, variantSku: string) {
  await page.getByPlaceholder('Search products by name, SKU, or barcode…').fill(productName);
  await page.getByRole('button', { name: productName }).first().click();
  await selectVariantOnly(page, variantSku);
}

// ============================================================================
// §1 FUNCTIONAL & BUSINESS LOGIC — happy paths, validation, constraints
// ============================================================================

test.describe.serial('Module 9 — Stock Movements & Adjustments (full-scope QA)', () => {
  test.describe.configure({ timeout: 180_000 });

  const state: {
    variantId: string;
    variantSku: string;
    productId: string;
    productName: string;
    baselineQty: number;
    threshold: number;
    movementIds: string[];
    /** net delta applied to the fixture variant; reverted in cleanup */
    netDelta: number;
  } = {
    variantId: '',
    variantSku: '',
    productId: '',
    productName: '',
    baselineQty: 0,
    threshold: 0,
    movementIds: [],
    netDelta: 0,
  };

  test('F0 snapshot: resolve fixture variant + baseline stock from the seeded catalog', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const { product, variant } = await pickVariant(page, 10);
    state.variantId = variant.id;
    state.variantSku = variant.sku;
    state.productId = product.id;
    state.productName = product.name;
    state.baselineQty = variant.stockQuantity;
    state.threshold = variant.lowStockThreshold ?? 5;
    expect(state.variantId, 'fixture variant resolved').toBeTruthy();

    // variant-lookup round-trips the same numbers.
    const v = await getVariant(page, state.variantId);
    expect(v.stockQuantity).toBe(state.baselineQty);
    expect(v.sku).toBe(state.variantSku);
    expect(String(v.retailPrice)).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  test('F1 stock-control dashboard renders KPI cards + recent activity ledger', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control', 'Stock Control');

    // KPI cards (seeded catalog ⇒ non-zero products; low-stock count ≥ 0).
    await expect(page.getByText('Total Products').first()).toBeVisible();
    await expect(page.getByText('Low Stock Variants').first()).toBeVisible();
    await expect(page.getByText('Pending Stock Takes').first()).toBeVisible();
    await expect(page.getByText('Total Stock Value (Retail)').first()).toBeVisible();

    // OWNER has product:view_cost_price → value renders as rupees, not Restricted.
    await expect(page.getByText('Restricted')).toHaveCount(0, { timeout: 30_000 });

    // Recent Activity table: seeded INITIAL_STOCK movements render with actor.
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 30_000 });
    const bodyText = await page.locator('body').innerText();
    expect(
      /INITIAL_STOCK|Found|Purchase Received|Stock Take|Data Error|Sale/i.test(bodyText),
      'recent-activity rows carry reason labels',
    ).toBe(true);
  });

  test('F2 manual adjustment UI: add stock happy path writes the ledger row', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    // Search + select the fixture product, then its variant.
    await selectFixtureVariant(page, state.productName, state.variantSku);

    // Current-stock badge shows the baseline (drift-tolerant: prior runs may
    // have left the variant a few units off the F0 snapshot).
    await expect(page.getByText(/\d+ units/).first()).toBeVisible({
      timeout: 30_000,
    });

    // Add 7 with a reason + note.
    await page.getByRole('button', { name: 'Add Stock' }).click();
    await page.getByPlaceholder('Enter quantity').fill('7');
    await page.locator('button').filter({ hasText: 'Select a reason' }).first().click();
    await page.getByRole('option', { name: 'Found' }).click();
    await page.getByPlaceholder(/Add any additional details/).fill(`${RUN} UI add`);

    await page.getByRole('button', { name: 'Submit Adjustment' }).click();
    // The toast interpolates the live before/after numbers.
    await expect(page.getByText(/Stock updated from \d+ to \d+ units\./)).toBeVisible({
      timeout: 30_000,
    });

    // DB truth: +7 applied and a FOUND ledger row exists with actor + note.
    const v = await getVariant(page, state.variantId);
    expect(v.stockQuantity).toBe(state.baselineQty + 7);
    state.netDelta += 7;

    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=10`,
      ),
    );
    const row = (ledger?.data ?? []).find(
      (m: any) => m.reason === 'FOUND' && m.quantityDelta === 7,
    );
    expect(row, 'FOUND +7 ledger row written').toBeTruthy();
    expect(row?.quantityBefore).toBe(state.baselineQty);
    expect(row?.quantityAfter).toBe(state.baselineQty + 7);
    expect(row?.actor?.email).toBe(OWNER.email);
    expect(row?.note).toBe(`${RUN} UI add`);
    if (row?.id) state.movementIds.push(row.id);
  });

  test('F3 form validation: submit blocked without product/variant/type/quantity/reason', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    // Nothing selected → submit is blocked client-side.
    await page.getByRole('button', { name: 'Submit Adjustment' }).click();
    await expect(page.getByText('Select a product', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Quantity min=1 (native constraint) — 0/negatives are invalid.
    const qty = page.getByPlaceholder('Enter quantity');
    await qty.fill('0');
    const validity = await qty.evaluate((el) => {
      const input = el as HTMLInputElement;
      return { min: input.min, valid: input.checkValidity() };
    });
    expect(validity.min).toBe('1');
    expect(validity.valid, 'quantity 0 fails native validation').toBe(false);

    // Note is capped at 500 chars in the UI.
    const note = page.getByPlaceholder(/Add any additional details/);
    expect(await note.getAttribute('maxlength')).toBe('500');

    // No ledger row was written by the blocked submit.
    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=50`,
      ),
    );
    expect(
      (ledger?.data ?? []).filter((m: any) => m.note === `${RUN} blocked`),
      'blocked submit wrote nothing',
    ).toHaveLength(0);
  });

  test('F4 UI remove-below-zero is blocked: preview warning + disabled submit', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    await selectFixtureVariant(page, state.productName, state.variantSku);

    // Remove far more than exists → live preview goes red + submit disabled.
    await page.getByRole('button', { name: 'Remove Stock' }).click();
    await page.getByPlaceholder('Enter quantity').fill(String(state.baselineQty + 1000));
    await expect(page.getByText(/Cannot reduce stock below zero/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Submit Adjustment' })).toBeDisabled();

    // API agrees: 400 'Stock cannot go below zero'.
    const res = await adjust(page, state.variantId, -(state.baselineQty + 1000), 'DAMAGED');
    expect(res.status, 'API below-zero → 400').toBe(400);
    expect(res.body?.error?.message).toMatch(/below zero/i);
  });

  test('F5 bulk-adjust happy path: 3 variants in one atomic batch', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Three DISTINCT variants (skip offsets guarantee uniqueness).
    const a = await pickVariant(page, 10, 0);
    const b = await pickVariant(page, 10, 1);
    const c = await pickVariant(page, 10, 2);
    const picks = [a, b, c];
    const ids = new Set(picks.map((p) => p.variant.id));
    expect(ids.size, 'three distinct variants picked').toBe(3);
    const before: Record<string, number> = {};
    for (const p of picks) before[p.variant.id] = (await getVariant(page, p.variant.id)).stockQuantity;

    const res = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [
        { variantId: a.variant.id, quantityDelta: 3, reason: 'PURCHASE_RECEIVED', note: `${RUN} bulk a` },
        { variantId: b.variant.id, quantityDelta: -2, reason: 'DAMAGED', note: `${RUN} bulk b` },
        { variantId: c.variant.id, quantityDelta: 1, reason: 'FOUND' },
      ],
    });
    expect(res.status(), 'bulk adjust → 200').toBe(200);
    const body = await json(res);
    expect(body?.data?.adjustedCount).toBe(3);
    expect(body?.data?.movements).toHaveLength(3);
    for (const m of body?.data?.movements ?? []) {
      state.movementIds.push(m.id);
      state.netDelta += 0; // tracked per-variant below
    }

    // Each variant moved by exactly its delta.
    expect((await getVariant(page, a.variant.id)).stockQuantity).toBe((before[a.variant.id] ?? 0) + 3);
    expect((await getVariant(page, b.variant.id)).stockQuantity).toBe((before[b.variant.id] ?? 0) - 2);
    expect((await getVariant(page, c.variant.id)).stockQuantity).toBe((before[c.variant.id] ?? 0) + 1);
    state.netDelta += 3 - 2 + 1; // only fixture-variant deltas matter for cleanup
    // Revert the non-fixture deltas immediately to keep the DB net-zero.
    await adjust(page, a.variant.id, -3, 'DATA_ERROR', `${RUN} revert a`);
    await adjust(page, b.variant.id, 2, 'DATA_ERROR', `${RUN} revert b`);
    await adjust(page, c.variant.id, -1, 'DATA_ERROR', `${RUN} revert c`);
  });

  test('F6 bulk-adjust validation: empty batch, >50 items, zero delta, bad reason → 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const empty = await apiPost(page, '/api/store/stock-control/bulk-adjust', { adjustments: [] });
    expect(empty.status(), 'empty batch → 400').toBe(400);

    const oversized = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: Array.from({ length: 51 }, (_, i) => ({
        variantId: state.variantId,
        quantityDelta: 1,
        reason: 'FOUND',
        note: `row-${i}`,
      })),
    });
    expect(oversized.status(), '51 items → 400 (max 50)').toBe(400);

    const zero = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [{ variantId: state.variantId, quantityDelta: 0, reason: 'FOUND' }],
    });
    expect(zero.status(), 'zero delta → 400').toBe(400);

    const badReason = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [{ variantId: state.variantId, quantityDelta: 1, reason: 'NOT_A_REASON' }],
    });
    expect(badReason.status(), 'invalid reason → 400').toBe(400);
  });

  test('F7 bulk-adjust atomicity: one below-zero row rolls back the WHOLE batch (422)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;

    const res = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [
        { variantId: state.variantId, quantityDelta: 5, reason: 'FOUND', note: `${RUN} atomic` },
        { variantId: state.variantId, quantityDelta: -(before + 500), reason: 'DAMAGED' },
      ],
    });
    expect(res.status(), 'below-zero inside batch → 422 BELOW_ZERO_STOCK').toBe(422);
    const body = await json(res);
    expect(body?.error?.code).toBe('BELOW_ZERO_STOCK');
    expect(body?.error?.message).toMatch(/negative stock/i);
    expect(body?.error?.message).toContain(state.variantSku);

    // Atomic: the +5 from row 1 must NOT have survived.
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);
  });

  test('F8 movements ledger page renders + filters (search, reason chips, sort, pagination)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/movements', 'Stock Movement History');
    await waitForHydratedInput(page, 'input[placeholder="Search by product name or SKU..."]');

    // Default window: last 30 days — seeded INITIAL_STOCK rows (~30d ago) may
    // fall outside; the QA rows from F2 are inside. Search for the fixture SKU.
    await page
      .getByPlaceholder('Search by product name or SKU...')
      .fill(state.variantSku);
    await expect(page).toHaveURL(/[?&]search=/, { timeout: 30_000 });
    await expect(page.getByRole('row').filter({ hasText: state.variantSku }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Ledger columns render before/after/delta/actor.
    for (const header of ['Date & Time', 'Product', 'Variant', 'Reason', 'Change', 'Before', 'After', 'Actor']) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }

    // Reason chip toggle: clicking "Found" DESELECTS it from the all-reasons
    // set (pill reads "10 of 11 reasons") → the ledger must exclude FOUND rows.
    await page.getByRole('button', { name: 'Found', exact: true }).first().click();
    await expect(page).toHaveURL(/reasons=/, { timeout: 30_000 });
    await expect(page.getByText('10 of 11 reasons')).toBeVisible({ timeout: 30_000 });
    // Wait for the refetched rows, then assert the exclusion server-side-wide:
    // no visible row carries the deselected reason.
    await page.waitForTimeout(1_500);
    const reasonCells = await page.locator('tbody tr td:nth-child(4)').allInnerTexts();
    expect(reasonCells.length, 'filtered rows present').toBeGreaterThan(0);
    for (const cell of reasonCells) expect(cell.trim()).not.toBe('Found');

    // Sort toggle flips the URL param.
    await page.getByRole('button', { name: /Date & Time/ }).click();
    await expect(page).toHaveURL(/sortOrder=asc/, { timeout: 30_000 });

    // Pagination footer shows real totals.
    await expect(
      page.getByText(/Showing \d+–\d+ of \d+/).or(page.getByText(/Page \d+ of \d+/)).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('F9 movements CSV export downloads with the correct header + filename', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const res = await page.request.get(
      `/api/store/stock-control/movements?format=csv&search=${encodeURIComponent(state.variantSku)}`,
    );
    expect(res.status(), 'csv export → 200').toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toMatch(/attachment; filename="stock-movements/);
    const csv = await res.text();
    expect(csv.split('\n')[0]).toBe(
      'Date,Product,SKU,Form,Pack Size,Reason,Reason Label,Change,Before,After,Actor,Note',
    );
    expect(csv).toContain(state.variantSku);
    expect(csv).toContain(OWNER.email);
  });

  test('F10 low-stock page lists seeded variants with shortfall + Adjust Stock deep-link', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/low-stock', 'Low Stock Variants');

    // Seeded catalog has ~15% below threshold → list is non-empty.
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
    for (const header of ['Product', 'Variant', 'Current Stock', 'Threshold', 'Shortfall', 'Retail Price']) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }

    // Shortfall math: shortfall = threshold − stock, sorted DESC.
    const firstRow = page.locator('tbody tr').first();
    const stock = Number(await firstRow.locator('td:nth-child(3)').innerText());
    const threshold = Number(await firstRow.locator('td:nth-child(4)').innerText());
    const shortfall = Number((await firstRow.locator('td:nth-child(5)').innerText()).replace('-', ''));
    expect(shortfall).toBe(threshold - stock);

    // Adjust Stock deep-link carries the variantId prefill param.
    const href = await firstRow.getByRole('link', { name: 'Adjust Stock' }).getAttribute('href');
    expect(href).toMatch(/\/stock-control\/adjust\?variantId=/);
  });

  test('F11 low-stock prefill: ?variantId= locks the form to the record', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Take the top low-stock variant from the API.
    const low = await json(await page.request.get('/api/store/stock-control/low-stock?limit=1'));
    const row = (low?.data ?? [])[0];
    expect(row, 'a low-stock variant exists').toBeTruthy();

    await page.goto(`${BASE_URL}/stock-control/adjust?variantId=${row.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: 'Manual Stock Adjustment' })).toBeVisible({
      timeout: 60_000,
    });
    await waitForHydratedInput(page, 'form');

    // Locked chip: SKU + stock rendered, product picker replaced by the lock.
    await expect(page.getByText('Locked to record')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(row.sku).first()).toBeVisible();
    await expect(page.getByText(`Stock: ${row.stock_quantity}`).first()).toBeVisible();
  });

  test('F12 variant-lookup contract: 400 missing param, 404 unknown id', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const missing = await page.request.get('/api/store/stock-control/variant-lookup');
    expect(missing.status(), 'missing variantId → 400').toBe(400);

    const ghost = await page.request.get(
      '/api/store/stock-control/variant-lookup?variantId=nonexistent-variant-xyz',
    );
    expect(ghost.status(), 'unknown variantId → 404').toBe(404);
  });

  test('F13 per-product movements endpoint scopes to that product only', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const res = await page.request.get(`/api/store/products/${state.productId}/movements?limit=50`);
    expect(res.status(), 'product movements → 200').toBe(200);
    const body = await json(res);
    const rows: any[] = body?.data ?? [];
    expect(rows.length, 'fixture product has ledger rows').toBeGreaterThan(0);
    for (const row of rows) {
      expect(row?.variant?.product?.name ?? row?.variant?.sku).toBeTruthy();
    }
    // Every row belongs to a variant of THIS product.
    const detail = await json(await page.request.get(`/api/store/products/${state.productId}`));
    const variantIds = new Set((detail?.data?.variants ?? []).map((v: any) => v.id));
    for (const row of rows.slice(0, 20)) {
      expect(variantIds.has(row.variantId), 'row variant belongs to the product').toBe(true);
    }
  });

  test('F14 summary endpoint: KPI math + permission-gated stock value', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const res = await page.request.get('/api/store/stock-control/summary');
    expect(res.status(), 'summary → 200').toBe(200);
    const s = (await json(res))?.data;
    expect(s?.totalProducts).toBeGreaterThan(0);
    expect(Number.isInteger(s?.lowStockVariants)).toBe(true);
    expect(s?.lowStockVariants).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s?.pendingStockTakes)).toBe(true);
    // OWNER holds product:view_cost_price → numeric value (LKR 2-dp money).
    expect(s?.totalStockValue).not.toBeNull();
    expect(typeof s?.totalStockValue).toBe('number');
    expect(Number.isFinite(s?.totalStockValue)).toBe(true);
  });

  test('F15 actors endpoint: distinct movement actors resolve to user emails', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const res = await page.request.get('/api/store/stock-control/actors');
    expect(res.status(), 'actors → 200').toBe(200);
    const actors: any[] = (await json(res))?.data ?? [];
    expect(actors.length, 'seeded movements have the OWNER as actor').toBeGreaterThan(0);
    for (const a of actors) {
      expect(a.id).toBeTruthy();
      expect(a.email).toContain('@');
    }
    expect(actors.some((a) => a.email === OWNER.email), 'OWNER appears as an actor').toBe(true);
  });

  // ── §2 Financial & calculation precision ───────────────────────────────────

  test('P1 stock-value math: summary total equals Σ(stock × retail) within tolerance', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Recompute the expected total from the catalog (2-dp LKR prices).
    const list = await json(await page.request.get('/api/store/products?limit=100'));
    const products: any[] = Array.isArray(list?.data) ? list.data : list?.data?.products ?? [];
    let expected = 0;
    for (const p of products) {
      let variants = p?.variants;
      if (!variants) {
        const detail = await json(await page.request.get(`/api/store/products/${p.id}`));
        variants = detail?.data?.variants ?? [];
      }
      for (const v of variants ?? []) {
        expected += (v.stockQuantity ?? 0) * Number(v.retailPrice ?? 0);
      }
    }
    expected = Math.round(expected * 100) / 100;

    const summary = (await json(await page.request.get('/api/store/stock-control/summary')))?.data;
    // The catalog list is capped at 100 products; the summary counts all.
    // Assert the summary is a sane positive number and within an order of
    // magnitude of the computed subset (guards against NaN/×10/×1000 bugs).
    expect(summary?.totalStockValue).toBeGreaterThan(0);
    const ratio = summary.totalStockValue / Math.max(expected, 1);
    expect(ratio, 'summary value is the same order of magnitude as Σ(stock×retail)').toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2.5);
  });

  test('P2 quantityDelta is integer-only: floats rejected 400, never partially applied', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;
    const res = await adjust(page, state.variantId, 2.5, 'FOUND');
    expect(res.status, 'float delta → 400 VALIDATION_ERROR').toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);
  });

  // ── §3 Cross-module cascade & ledger impact ────────────────────────────────

  test('L1 ledger integrity: before+delta=after chain holds and rows are append-only', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Apply a +4 then a −1; both rows must chain correctly.
    const r1 = await adjust(page, state.variantId, 4, 'DATA_ERROR', `${RUN} chain +4`);
    expect(r1.status).toBe(200);
    state.netDelta += 4;
    const r2 = await adjust(page, state.variantId, -1, 'DATA_ERROR', `${RUN} chain −1`);
    expect(r2.status).toBe(200);
    state.netDelta -= 1;

    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=20&sortOrder=desc`,
      ),
    );
    const rows: any[] = ledger?.data ?? [];
    const mine = rows.filter((m) => String(m.note ?? '').includes(RUN));
    expect(mine.length).toBeGreaterThanOrEqual(2);

    // Chain: each row's after equals before+delta; consecutive rows on the
    // same variant link (row[n].before === row[n+1].after for desc order).
    for (const m of mine) {
      expect(m.quantityBefore + m.quantityDelta).toBe(m.quantityAfter);
    }
    const sorted = [...mine].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].quantityBefore, 'ledger chain links consecutive rows').toBe(
        sorted[i + 1].quantityAfter,
      );
    }
    for (const m of mine) if (m.id) state.movementIds.push(m.id);
  });

  test('L2 low-stock cascade: crossing the threshold fires LOW_STOCK_ALERT notifications', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Drive the fixture variant to exactly its threshold (or 0 if threshold 0).
    const v0 = await getVariant(page, state.variantId);
    const target = Math.max(state.threshold, 1);
    const down = v0.stockQuantity - target;
    expect(down, 'fixture has enough stock to drive low').toBeGreaterThan(0);

    const res = await adjust(page, state.variantId, -down, 'DAMAGED', `${RUN} low-stock drive`);
    expect(res.status).toBe(200);
    state.netDelta -= down;
    expect(res.body?.data?.lowStockTriggered).toBe(true);
    expect(res.body?.data?.quantityAfter).toBe(target);

    // OWNER/MANAGER recipients received LOW_STOCK_ALERT rows.
    const notifRes = await page.request.get('/api/notifications?limit=50&includeRead=true');
    if (notifRes.status() === 200) {
      const notifs = await json(notifRes);
      const rows: any[] = notifs?.data?.notifications ?? [];
      const alert = rows.find(
        (n) => n.type === 'LOW_STOCK_ALERT' && String(n.title ?? '').includes(state.variantSku),
      );
      expect(alert, 'LOW_STOCK_ALERT notification written for the OWNER').toBeTruthy();
      expect(String(alert?.title)).toContain(state.productName);
    } else {
      // Notifications API shape differs — fall back to the low-stock page.
      const low = await json(
        await page.request.get('/api/store/stock-control/low-stock?limit=100'),
      );
      const ids: string[] = (low?.data ?? []).map((r: any) => r.id);
      expect(ids).toContain(state.variantId);
    }

    // Restore the stock immediately (keep the DB near baseline).
    const up = await adjust(page, state.variantId, down, 'DATA_ERROR', `${RUN} low-stock restore`);
    expect(up.status).toBe(200);
    state.netDelta += down;
  });

  // ── §4 Audit trail, void & cancellation (immutability) ─────────────────────

  test('A1 ledger is append-only: no UPDATE/DELETE routes exist on movements', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // No mutation verbs on the movements collection or item paths.
    const del = await page.request.delete('/api/store/stock-control/movements');
    expect([404, 405], 'DELETE collection → 404/405 (no route)').toContain(del.status());
    const put = await page.request.put('/api/store/stock-control/movements', {
      data: { quantityDelta: 0 },
      headers: { 'content-type': 'application/json' },
    });
    expect([404, 405], 'PUT collection → 404/405 (no route)').toContain(put.status());
    const patchItem = await page.request.patch(
      `/api/store/stock-control/movements/${state.movementIds[0] ?? 'nonexistent'}`,
      { data: { quantityDelta: 999 }, headers: { 'content-type': 'application/json' } },
    );
    expect([404, 405], 'PATCH item → 404/405 (no route)').toContain(patchItem.status());

    // The rows written by this run still exist. Rows may belong to several
    // variants (F5 batches 3 of them), so search unfiltered and index by id.
    const ledger = await json(
      await page.request.get('/api/store/stock-control/movements?limit=100'),
    );
    const byId = new Map((ledger?.data ?? []).map((m: any) => [m.id, m]));
    for (const id of state.movementIds) {
      expect(byId.has(id), `movement ${id} still present (no hard delete)`).toBe(true);
    }
  });

  test('A2 every ledger row carries reason + actor + before/after (audit-complete)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const ledger = await json(
      await page.request.get('/api/store/stock-control/movements?limit=50'),
    );
    const rows: any[] = ledger?.data ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const m of rows.slice(0, 25)) {
      expect(m.reason, 'reason code present').toBeTruthy();
      expect(m.actor?.email, 'actor present (BUG-4 class regression guard)').toBeTruthy();
      expect(typeof m.quantityDelta).toBe('number');
      expect(typeof m.quantityBefore).toBe('number');
      expect(typeof m.quantityAfter).toBe('number');
      expect(m.quantityBefore + m.quantityDelta).toBe(m.quantityAfter);
      expect(new Date(m.createdAt).getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
    }
  });

  // ── §5 Chaos, button spamming & race conditions ────────────────────────────

  test('R1 double-click Submit Adjustment applies exactly once', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    await selectFixtureVariant(page, state.productName, state.variantSku);

    const before = (await getVariant(page, state.variantId)).stockQuantity;

    await page.getByRole('button', { name: 'Add Stock' }).click();
    await page.getByPlaceholder('Enter quantity').fill('2');
    await page.locator('button').filter({ hasText: 'Select a reason' }).first().click();
    await page.getByRole('option', { name: 'Data Error' }).click();
    await page.getByPlaceholder(/Add any additional details/).fill(`${RUN} dblclick`);

    await page.getByRole('button', { name: 'Submit Adjustment' }).dblclick();
    await expect(page.getByText(/Stock updated from \d+ to \d+ units\./)).toBeVisible({
      timeout: 30_000,
    });

    // Exactly +2 (not +4): the button disables while submitting.
    const after = (await getVariant(page, state.variantId)).stockQuantity;
    expect(after - before, 'double-click applies exactly one adjustment').toBe(2);
    state.netDelta += 2;

    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=20`,
      ),
    );
    const dbl = (ledger?.data ?? []).filter((m: any) => m.note === `${RUN} dblclick`);
    expect(dbl, 'exactly one ledger row for the double-click').toHaveLength(1);
    if (dbl[0]?.id) state.movementIds.push(dbl[0].id);
  });

  test('R2 concurrent identical adjustments: zero 500s, all deltas land (no lost updates)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;
    const results = await Promise.all(
      [1, 2, 3].map((i) => adjust(page, state.variantId, 1, 'FOUND', `${RUN} race ${i}`)),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s >= 500), 'zero 500s under 3-way race').toHaveLength(0);
    expect(statuses.every((s) => s === 200), 'all three accepted').toBe(true);

    // All three increments survive (increment is atomic in Prisma/Postgres).
    const after = (await getVariant(page, state.variantId)).stockQuantity;
    expect(after - before).toBe(3);
    state.netDelta += 3;

    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=30`,
      ),
    );
    const raced = (ledger?.data ?? []).filter((m: any) => String(m.note ?? '').startsWith(`${RUN} race`));
    expect(raced).toHaveLength(3);
    for (const m of raced) if (m.id) state.movementIds.push(m.id);
  });

  test('R3 concurrent bulk batches on the same variant: zero 500s, totals reconcile', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;
    const batches = await Promise.all(
      [1, 2].map((n) =>
        apiPost(page, '/api/store/stock-control/bulk-adjust', {
          adjustments: [
            { variantId: state.variantId, quantityDelta: 2, reason: 'FOUND', note: `${RUN} bulkrace ${n}` },
          ],
        }),
      ),
    );
    const statuses = batches.map((b) => b.status());
    expect(statuses.filter((s) => s >= 500), 'zero 500s').toHaveLength(0);
    expect(statuses.every((s) => s === 200), 'both batches accepted').toBe(true);

    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before + 4);
    state.netDelta += 4;
  });

  // ── §6 Hardware & device simulation ────────────────────────────────────────

  test('H1 barcode-scanner keystroke burst + trailing Enter resolves the product in the adjust form', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    // Hardware scanner = rapid keystroke burst (2 ms cadence) terminated by
    // Enter. FIXED (M09-03/OBS-18): Enter no longer dismisses the popover —
    // it flushes the debounced search and selects the highlighted (top)
    // result, so the barcode-first flow resolves without a manual click.
    const search = page.getByPlaceholder('Search products by name, SKU, or barcode…');
    await search.click();
    await page.keyboard.type(state.productName, { delay: 2 });
    await page.keyboard.press('Enter');

    // The Enter-terminated burst selected the top product: the product chip
    // replaced the search input (popover closed, no manual click).
    await expect(
      page.getByText(state.productName, { exact: true }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(search).toHaveCount(0);

    // Select the variant directly — form is armed: current-stock badge
    // visible, submit enabled after reason.
    await selectVariantOnly(page, state.variantSku);
    await expect(page.getByText(/\d+ units/).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('H2 rapid-fire API adjustments (scanner-burst analogue): 10 sequential posts all 200', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;
    for (let i = 0; i < 10; i++) {
      const res = await adjust(page, state.variantId, 1, 'FOUND', `${RUN} burst ${i}`);
      expect(res.status, `burst ${i} → 200`).toBe(200);
      state.netDelta += 1;
    }
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before + 10);
  });

  // ── §7 Network resilience & offline sync ───────────────────────────────────

  test('N1 adjust API 500 → error toast, form stays interactive', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    await selectFixtureVariant(page, state.productName, state.variantSku);

    await page.getByRole('button', { name: 'Add Stock' }).click();
    await page.getByPlaceholder('Enter quantity').fill('1');
    await page.locator('button').filter({ hasText: 'Select a reason' }).first().click();
    await page.getByRole('option', { name: 'Found' }).click();

    await page.route('**/api/store/stock-control/adjust', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }),
    );
    await page.getByRole('button', { name: 'Submit Adjustment' }).click();
    await expect(page.getByText(/Failed to adjust stock|Network error/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Form remains interactive after the failure.
    await expect(page.getByRole('button', { name: 'Submit Adjustment' })).toBeEnabled();
    await page.unroute('**/api/store/stock-control/adjust');
  });

  test('N2 movements API 504 → ledger page degrades gracefully (no white-screen)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/stock-control/movements?**', (route) =>
      route.fulfill({ status: 504, contentType: 'application/json', body: '{"success":false}' }),
    );
    await page.goto(`${BASE_URL}/stock-control/movements`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length, 'page still renders content').toBeGreaterThan(50);
    const pageError: string[] = [];
    page.on('pageerror', (e) => pageError.push(e.message));
    await page.waitForTimeout(500);
    expect(pageError.length, `uncaught page errors: ${pageError.join(' | ')}`).toBe(0);
    await page.unroute('**/api/store/stock-control/movements?**');
  });

  test('N3 offline adjust → network-error toast; recovers on reconnect', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await gotoStockPage(page, '/stock-control/adjust', 'Manual Stock Adjustment');
    await waitForHydratedInput(page, 'form');

    await selectFixtureVariant(page, state.productName, state.variantSku);

    await page.getByRole('button', { name: 'Add Stock' }).click();
    await page.getByPlaceholder('Enter quantity').fill('1');
    await page.locator('button').filter({ hasText: 'Select a reason' }).first().click();
    await page.getByRole('option', { name: 'Found' }).click();

    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Submit Adjustment' }).click();
    await expect(page.getByText(/Network error|Failed to adjust stock/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.context().setOffline(false);

    // Recovery: the same submit succeeds once connectivity returns.
    await page.getByRole('button', { name: 'Submit Adjustment' }).click();
    await expect(page.getByText(/Stock updated from \d+ to \d+ units\./)).toBeVisible({
      timeout: 30_000,
    });
    state.netDelta += 1;
  });

  // ── §8 Security, RBAC & multi-branch isolation ─────────────────────────────

  test('S1 unauthenticated: every stock-control API 401, pages bounce to /login', async ({ page }) => {
    const matrix: Array<[string, any]> = [
      ['POST adjust', await page.request.post('/api/store/stock-control/adjust', {
        data: { variantId: state.variantId, quantityDelta: 1, reason: 'FOUND' },
        headers: { 'content-type': 'application/json' },
      })],
      ['POST bulk-adjust', await page.request.post('/api/store/stock-control/bulk-adjust', {
        data: { adjustments: [] },
        headers: { 'content-type': 'application/json' },
      })],
      ['GET movements', await page.request.get('/api/store/stock-control/movements')],
      ['GET recent-movements', await page.request.get('/api/store/stock-control/recent-movements')],
      ['GET summary', await page.request.get('/api/store/stock-control/summary')],
      ['GET actors', await page.request.get('/api/store/stock-control/actors')],
      ['GET variant-lookup', await page.request.get('/api/store/stock-control/variant-lookup?variantId=x')],
      ['GET low-stock', await page.request.get('/api/store/stock-control/low-stock')],
      ['GET product movements', await page.request.get(`/api/store/products/${state.productId}/movements`)],
    ];
    for (const [label, res] of matrix) {
      expect(res.status(), `unauth ${label} → 401`).toBe(401);
    }

    for (const path of ['/stock-control', '/stock-control/adjust', '/stock-control/movements']) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    }
  });

  test('S2 CASHIER: adjust/bulk/lookup 403 (no stock:adjust); read endpoints allowed', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);

    const adj = await adjust(page, state.variantId, 1, 'FOUND');
    expect(adj.status, 'CASHIER adjust → 403').toBe(403);
    const bulk = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [{ variantId: state.variantId, quantityDelta: 1, reason: 'FOUND' }],
    });
    expect(bulk.status(), 'CASHIER bulk-adjust → 403').toBe(403);
    const lookup = await page.request.get(
      `/api/store/stock-control/variant-lookup?variantId=${state.variantId}`,
    );
    expect(lookup.status(), 'CASHIER variant-lookup → 403').toBe(403);

    // CASHIER holds product:view (read) but NOT stock:view → ledger reads 403.
    const movements = await page.request.get('/api/store/stock-control/movements');
    expect(movements.status(), 'CASHIER movements → 403 (no stock:view)').toBe(403);
    const summary = await page.request.get('/api/store/stock-control/summary');
    expect(summary.status(), 'CASHIER summary → 200 (auth-only route)').toBe(200);
    const low = await page.request.get('/api/store/stock-control/low-stock');
    expect(low.status(), 'CASHIER low-stock → 403 (no stock:view)').toBe(403);

    // UI: the adjust page renders the Permission Denied card.
    await page.goto(`${BASE_URL}/stock-control/adjust`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Permission Denied')).toBeVisible({ timeout: 60_000 });
  });

  test('S3 cross-tenant isolation: tenant-2 owner cannot adjust tenant-1 variants; ledger is tenant-scoped', async ({ page }) => {
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);

    // Write path: another tenant's variant → 404 NOT_FOUND (tenant filter).
    const adj = await adjust(page, state.variantId, 5, 'FOUND', 'cross-tenant attempt');
    expect(adj.status, 'cross-tenant adjust → 404').toBe(404);
    expect(adj.body?.error?.code).toBe('NOT_FOUND');

    // Bulk path: mixed batch containing a foreign variant → 400 invalid ids.
    const bulk = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [{ variantId: state.variantId, quantityDelta: 1, reason: 'FOUND' }],
    });
    expect(bulk.status(), 'cross-tenant bulk → 400 (invalid variant ids)').toBe(400);

    // Read path: tenant-2 ledger is empty (no catalog seeded) and never
    // contains tenant-1 rows.
    const ledger = await json(await page.request.get('/api/store/stock-control/movements?limit=100'));
    const rows: any[] = ledger?.data ?? [];
    expect(rows, 'tenant-2 ledger has no tenant-1 rows').toHaveLength(0);

    // variant-lookup for a foreign variant → 404.
    const lookup = await page.request.get(
      `/api/store/stock-control/variant-lookup?variantId=${state.variantId}`,
    );
    expect(lookup.status(), 'cross-tenant variant-lookup → 404').toBe(404);
  });

  // ── §9 Boundary inputs & chaos data ────────────────────────────────────────

  test('X1 validation contract: bad variantId / missing fields / bad reason / long note → 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const cases: Array<[string, Record<string, unknown>, number]> = [
      ['missing variantId', { quantityDelta: 1, reason: 'FOUND' }, 400],
      ['missing quantityDelta', { variantId: state.variantId, reason: 'FOUND' }, 400],
      ['missing reason', { variantId: state.variantId, quantityDelta: 1 }, 400],
      ['invalid reason', { variantId: state.variantId, quantityDelta: 1, reason: 'HACKED' }, 400],
      ['non-int delta', { variantId: state.variantId, quantityDelta: 1.5, reason: 'FOUND' }, 400],
      ['string delta', { variantId: state.variantId, quantityDelta: 'two', reason: 'FOUND' }, 400],
      [
        'note 501 chars',
        { variantId: state.variantId, quantityDelta: 1, reason: 'FOUND', note: 'n'.repeat(501) },
        400,
      ],
      [
        'unknown variant (non-cuid)',
        { variantId: 'nonexistent-variant-xyz', quantityDelta: 1, reason: 'FOUND' },
        400, // cuid schema check fires BEFORE the tenant lookup
      ],
      [
        'unknown variant (well-formed cuid)',
        { variantId: 'c' + '0'.repeat(24), quantityDelta: 1, reason: 'FOUND' },
        404, // passes zod, fails the tenant-scoped lookup
      ],
    ];
    for (const [label, payload, expected] of cases) {
      const res = await apiPost(page, '/api/store/stock-control/adjust', payload);
      const body = await json(res);
      expect(res.status(), `${label} → ${expected}`).toBe(expected);
      if (expected === 400) {
        expect(body?.error?.code, `${label} typed VALIDATION_ERROR`).toBe('VALIDATION_ERROR');
      }
    }
  });

  test('X2 zero delta rejected by the ≠0 refine: 400, no ledger row', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // FIXED (M09-03/OBS-19): StockAdjustmentSchema now refines quantityDelta
    // !== 0 (parity with the bulk schema). Zero-delta → 400 VALIDATION_ERROR
    // and no 0-delta noise row lands in the immutable ledger.
    const before = (await getVariant(page, state.variantId)).stockQuantity;
    const res = await adjust(page, state.variantId, 0, 'DATA_ERROR', `${RUN} zero-delta pin`);
    expect(res.status, 'zero delta → 400 (≠0 refine landed)').toBe(400);
    expect(res.body?.error?.code, 'typed VALIDATION_ERROR').toBe('VALIDATION_ERROR');
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);

    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=20`,
      ),
    );
    const zeroRow = (ledger?.data ?? []).find((m: any) => m.note === `${RUN} zero-delta pin`);
    expect(zeroRow, 'no 0-delta ledger row written').toBeFalsy();
  });

  test('X3 Unicode + XSS note round-trips inert through the ledger', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const unicodeNote = `සටහන ${RUN} குறிப்பு 🌿`;
    const r1 = await adjust(page, state.variantId, 1, 'FOUND', unicodeNote);
    expect(r1.status, 'unicode note → 200').toBe(200);
    state.netDelta += 1;

    const xssNote = `<img src=x onerror="window.__m09xss=1"> ${RUN}`;
    const r2 = await adjust(page, state.variantId, 1, 'FOUND', xssNote);
    expect(r2.status, 'xss note → 200 (stored verbatim)').toBe(200);
    state.netDelta += 1;

    // Round-trip via the ledger API.
    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=30`,
      ),
    );
    const rows: any[] = ledger?.data ?? [];
    expect(rows.find((m) => m.note === unicodeNote), 'unicode note byte-exact').toBeTruthy();
    expect(rows.find((m) => m.note === xssNote), 'xss note stored verbatim').toBeTruthy();

    // Rendered inert in the movements UI (title attribute, never executed).
    await page.goto(
      `${BASE_URL}/stock-control/movements?search=${encodeURIComponent(state.variantSku)}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('row').filter({ hasText: state.variantSku }).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);
    const fired = await page.evaluate(() => (window as any).__m09xss);
    expect(fired, 'onerror handler must never execute').toBeUndefined();
  });

  test('X4 hostile quantities: int4-overflow add → 400 (cap); below-zero → 400; stock never corrupted', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;

    // FIXED (M09-02/BUG-41): StockAdjustmentSchema caps |quantityDelta| at
    // 1,000,000 (documented business ceiling) and the route keeps a
    // newQty > INT_MAX guard as defense in depth. An INT_MAX-scale add is a
    // typed 400 VALIDATION_ERROR — never a 500 — and stock is untouched.
    const overflow = await adjust(page, state.variantId, 2_147_483_647, 'FOUND', `${RUN} overflow pin`);
    expect(
      overflow.status,
      'INT_MAX add → 400 (sane-cap validation, was 500 pin)',
    ).toBe(400);
    expect(overflow.body?.error?.code, 'typed VALIDATION_ERROR').toBe('VALIDATION_ERROR');
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);

    // The old INT_MAX−stock boundary add now also exceeds the 1M cap → 400
    // (aligned to the client-chosen ceiling per the M09-02 gate note).
    const boundary = await adjust(page, state.variantId, 2_147_483_647 - before, 'FOUND', `${RUN} boundary max`);
    expect(boundary.status, 'INT_MAX−stock add → 400 too (cap < int4 max)').toBe(400);
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);

    // Below-zero removal stays correctly typed 400 (BELOW_ZERO guard).
    const negHuge = await adjust(page, state.variantId, -(before + 500), 'DAMAGED');
    expect(negHuge.status, 'removal below zero → 400 (typed)').toBe(400);
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);

    // Cap-boundary sanity: the largest allowed add succeeds and is reverted
    // immediately (proves the 400s above are the cap, not a broken route).
    const ok = await adjust(page, state.variantId, 1_000_000, 'FOUND', `${RUN} cap max`);
    expect(ok.status, 'delta at the 1,000,000 ceiling → 200').toBe(200);
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before + 1_000_000);
    const back = await adjust(page, state.variantId, -1_000_000, 'DATA_ERROR', `${RUN} cap revert`);
    expect(back.status, 'revert the cap add → 200').toBe(200);
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);
  });

  test('X5 bulk-adjust cross-tenant chaos: foreign id in batch → 400, batch not applied', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const before = (await getVariant(page, state.variantId)).stockQuantity;
    const res = await apiPost(page, '/api/store/stock-control/bulk-adjust', {
      adjustments: [
        { variantId: state.variantId, quantityDelta: 3, reason: 'FOUND' },
        { variantId: 'foreign-tenant-variant-id', quantityDelta: 1, reason: 'FOUND' },
      ],
    });
    expect(res.status(), 'mixed batch with foreign id → 400').toBe(400);
    const body = await json(res);
    expect(body?.error?.message).toContain('foreign-tenant-variant-id');
    // Pre-check rejects before any write.
    expect((await getVariant(page, state.variantId)).stockQuantity).toBe(before);
  });

  // ── §10 Time-travel & retroactive date handling ────────────────────────────

  test('T1 from/to window filters: seeded INITIAL_STOCK rows are reachable via a wide window', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Wide window covering the seed horizon (seed rows measured at ~62 days
    // back in this environment; the seed code targets "~30 days" but the
    // running DB has older data). 90 days comfortably covers both.
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const wide = await json(
      await page.request.get(
        `/api/store/stock-control/movements?from=${from}&to=${to}&limit=100&reasons=INITIAL_STOCK`,
      ),
    );
    const wideRows: any[] = wide?.data ?? [];
    expect(wideRows.length, 'seeded INITIAL_STOCK rows inside the 90-day window').toBeGreaterThan(0);
    for (const m of wideRows) {
      expect(m.reason).toBe('INITIAL_STOCK');
      const ts = new Date(m.createdAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(new Date(`${from}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000);
      expect(ts).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Narrow future window → zero rows (no future-dated ledger entries).
    const fFrom = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fTo = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const future = await json(
      await page.request.get(`/api/store/stock-control/movements?from=${fFrom}&to=${fTo}&limit=50`),
    );
    expect(future?.data ?? []).toHaveLength(0);

    // FIXED (XC-01): from/to go through parseQueryDate — malformed and
    // calendar-impossible dates are a typed 400 naming the param (BUG-40).
    const bad = await page.request.get('/api/store/stock-control/movements?from=not-a-date');
    expect(bad.status(), 'malformed from → 400 (BUG-40 fixed)').toBe(400);
    expect(((await bad.json()).error ?? {}).message).toContain('from');
    const badTo = await page.request.get('/api/store/stock-control/movements?to=2026-13-45');
    expect(badTo.status(), 'impossible to-date → 400 (BUG-40 fixed)').toBe(400);
    const roll = await page.request.get('/api/store/stock-control/movements?from=2026-02-30');
    expect(roll.status(), 'Feb-30 rejected as not a real calendar date').toBe(400);
  });

  test('T2 sortOrder asc|desc both honored; client cannot forge createdAt on a movement', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const desc = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&sortOrder=desc&limit=10`,
      ),
    );
    const asc = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&sortOrder=asc&limit=10`,
      ),
    );
    const d: any[] = desc?.data ?? [];
    const a: any[] = asc?.data ?? [];
    expect(d.length).toBeGreaterThan(0);
    expect(a.length).toBeGreaterThan(0);
    expect(new Date(d[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(d[d.length - 1].createdAt).getTime(),
    );
    expect(new Date(a[0].createdAt).getTime()).toBeLessThanOrEqual(
      new Date(a[a.length - 1].createdAt).getTime(),
    );

    // The adjust schema strips unknown keys — createdAt forgery is ignored.
    const res = await apiPost(page, '/api/store/stock-control/adjust', {
      variantId: state.variantId,
      quantityDelta: 1,
      reason: 'FOUND',
      note: `${RUN} forge`,
      createdAt: '1999-01-01T00:00:00.000Z',
    });
    const forgeStatus = res.status();
    expect(forgeStatus, 'forged createdAt ignored → 200').toBe(200);
    state.netDelta += 1;
    const row = (await json(res))?.data?.movement;
    expect(new Date(row?.createdAt ?? Date.now()).getFullYear()).toBeGreaterThan(2020);
  });

  // ── Cleanup: net-zero restore of the fixture variant ───────────────────────

  test('cleanup: revert every net delta and verify the fixture variant is back at baseline', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const current = (await getVariant(page, state.variantId)).stockQuantity;
    const drift = current - state.baselineQty;
    if (drift !== 0) {
      const res = await adjust(
        page,
        state.variantId,
        -drift,
        'DATA_ERROR',
        `${RUN} cleanup restore`,
      );
      expect(res.status, 'cleanup restore → 200').toBe(200);
    }

    const final = (await getVariant(page, state.variantId)).stockQuantity;
    expect(final, 'fixture variant restored to F0 baseline').toBe(state.baselineQty);

    // Ledger rows written by this run remain (append-only) — nothing deleted.
    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent(state.variantSku)}&limit=100`,
      ),
    );
    const mine = (ledger?.data ?? []).filter((m: any) => String(m.note ?? '').includes(RUN));
    expect(mine.length, 'all RUN ledger rows still present (immutability)').toBeGreaterThan(0);
  });
});
