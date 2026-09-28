import { test, expect, type Page } from '@playwright/test';

/**
 * 02_inventory.spec.ts — MODULE 2: Inventory & Products
 *
 * Cross-checked against erp/docs/qa/QA_CLIENT_REQ.md (the master client-requirements
 * checklist; the copy under test-results/ is a disposable Playwright mirror):
 *   • Group 2.1 — Product Catalog Structure (Ayurvedic adaptation)
 *   • Group 1.5 — Notifications & Alerts (low-stock at reorder level)
 *   • Group 3.10 (partial) — batch/expiry + item deactivation
 *
 * AUDIT RESULT SUMMARY (see QA_BUG_REPORT.md for detail)
 *   ✅ Category / classification adapted for Ayurveda      (2.1 bullet 1)
 *   ✅ Active Ingredients field — added & displayed        (2.1 bullet 2)
 *   ✅ Usage Instructions field — added                    (2.1 bullet 3)
 *   ✅ 2.1 bullet 4: "Safety Precautions" is a dedicated field. There is NO
 *      separate "Dosage recommendations" field — GAP-1 was CLOSED by product
 *      decision (2026-09-04): dosage guidance is authored inside the existing
 *      Description / Usage Instructions free-text fields. "Dosage form"
 *      (POWDER/TABLET/…) remains the variant *form factor*, unrelated to it.
 *   ✅ Low-stock alerts at per-variant reorder level + in-app notification (1.5)
 *   ✅ Item deactivation via archive; batch & expiry tracking screen present
 *   ✅ BUG-1 FIXED (M02-01, 2026-09-15): the leftover apparel "Gender" column
 *      header was renamed to "Variants" — it renders the variant count.
 *
 * Tests run in serial: the create test publishes `product`, which the
 * search / edit / low-stock / archive tests reuse.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

const OWNER = {
  email: 'owner@dilani-ayurwellness.lk',
  password: 'owner123!',
} as const;

/** Unique per run so parallel CI runs never collide on SKU / product name. */
const RUN_ID = `${Date.now().toString(36)}${process.env.TEST_WORKER_INDEX ?? '0'}`.slice(-6);

/** Apparel vocabulary that must NOT survive in an Ayurveda catalog. */
const APPAREL_TERMS = /shirt|dress|apparel|trouser|gender|colour|color/i;

// ── Generic helpers ──────────────────────────────────────────────────────────

/**
 * Client components are interactive only after hydration; clicking a submit
 * button or filling an input earlier means React never receives the event (a
 * *native* GET form submission, or a silently dropped debounced update).
 * Gate on React stamping `__reactProps$…` onto the target node — works for a
 * <form> or any other element passed as `selector`.
 */
async function waitForHydratedForm(page: Page, selector = 'form', timeout = 30_000) {
  await page.waitForFunction(
    (sel) => {
      const form = document.querySelector(sel);
      if (!form) return false;
      return Object.getOwnPropertyNames(form).some((key) => key.startsWith('__reactProps$'));
    },
    selector,
    { timeout },
  );
}

/** Log in as the owner and land on the dashboard. */
async function loginAsOwner(page: Page) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedForm(page);
  await page.getByLabel('Email address').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/** Radix Select triggers expose their placeholder as button text. */
async function openSelectByPlaceholder(page: Page, placeholder: string) {
  await page.locator(`button:has-text("${placeholder}")`).first().click();
  return page.getByRole('option');
}

/** Add a chip (dosage form / pack size) to a chip input and commit with Enter. */
async function addChip(page: Page, placeholder: string, value: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(value);
  await input.press('Enter');
}

export interface WizardProduct {
  name: string;
  sku: string;
  costPrice: string;
  retailPrice: string;
  initialStock: string;
  lowStockThreshold: string;
}

/**
 * Drive the 3-step Add Product wizard end-to-end, filling the Ayurvedic health
 * content plus cost / retail / initial stock / reorder level.
 */
async function createProductViaWizard(
  page: Page,
  overrides: Partial<WizardProduct> = {},
): Promise<WizardProduct> {
  const data: WizardProduct = {
    name: `QA Ashwagandha ${RUN_ID}`,
    sku: `QA-${RUN_ID}-POW`,
    costPrice: '900',
    retailPrice: '1450',
    initialStock: '20',
    lowStockThreshold: '5',
    ...overrides,
  };

  await page.goto(`${BASE_URL}/inventory/new`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedForm(page);

  // Step 1: basic info + Ayurvedic health content.
  await page.getByLabel('Product Name').fill(data.name);
  await page.getByLabel('Description').fill('QA-created adaptogen powder for stress relief.');
  await page.getByLabel('Active Ingredients').fill('Ashwagandha root extract, Black pepper');
  await page.getByLabel('Usage Instructions').fill('Take 1 teaspoon twice daily after meals.');
  await page.getByLabel('Health Benefits').fill('Supports stamina and reduces stress.');
  await page.getByLabel('Safety Precautions').fill('Not recommended during pregnancy.');

  const categoryOptions = await openSelectByPlaceholder(page, 'Select a category');
  await expect(categoryOptions.first()).toBeVisible();
  await categoryOptions.first().click();

  await page.getByRole('button', { name: 'Next: Variants' }).click();
  await expect(page.getByRole('heading', { name: 'Step 2: Variant Matrix' })).toBeVisible();
  await waitForHydratedForm(page);

  // Step 2: dosage form + pack size generate the variant matrix.
  await addChip(page, 'Type a form (e.g. POWDER) and press Enter', 'POWDER');
  await addChip(page, 'Type a pack size (e.g. 75g, 200ml) and press Enter', '100g');

  const skuInput = page.locator('#sku-0');
  await expect(skuInput).toBeVisible();
  // Overwrite the auto-derived SKU: it is built from the product name's first
  // three letters, so it collides with every previous QA run ("SKU already
  // exists" -> the API answers 207 PARTIAL_SUCCESS, see QA_BUG_REPORT BUG-2).
  await skuInput.fill(data.sku);
  expect((await skuInput.inputValue()).trim()).toBe(data.sku);

  await page.locator('#stock-0').fill(data.initialStock);
  await page.locator('#cost-0').fill(data.costPrice);
  await page.locator('#retail-0').fill(data.retailPrice);
  await page.locator('#low-0').fill(data.lowStockThreshold);

  await page.getByRole('button', { name: 'Next: Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review & Create' })).toBeVisible();

  // Step 3: persist.
  await page.getByRole('button', { name: 'Create Product' }).click();
  await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/inventory/, { timeout: 15_000 });

  return data;
}

/** Search the inventory list for `name` and open its detail page. */
async function openProductDetail(page: Page, name: string) {
  await page.goto(`${BASE_URL}/inventory?search=${encodeURIComponent(name)}`, {
    waitUntil: 'domcontentloaded',
  });
  const row = page.getByRole('row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  // View / Edit render as <a> (Button asChild), Archive / Delete as <button>.
  await row.getByRole('link', { name: `View ${name}` }).click();
  // Generous: the dynamic /inventory/[productId] route compiles on first hit in dev.
  await expect(page).toHaveURL(/\/inventory\/[^/?]+/, { timeout: 90_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe.serial('Module 2 — Inventory & Products', () => {
  // First visits compile routes on demand under `yarn dev`, so the default
  // 30s per-test budget is too tight for this suite.
  test.describe.configure({ timeout: 180_000 });

  let product: WizardProduct;

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test('2.1 Add Product form exposes the Ayurvedic health fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/inventory/new`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedForm(page);

    // The four implemented Ayurvedic fields.
    await expect(page.getByLabel('Active Ingredients')).toBeVisible();
    await expect(page.getByLabel('Usage Instructions')).toBeVisible();
    await expect(page.getByLabel('Health Benefits')).toBeVisible();
    await expect(page.getByLabel('Safety Precautions')).toBeVisible();
    await expect(page.getByText('Health Information (shown on storefront)')).toBeVisible();

    // Category classification exists and is Ayurveda-oriented (no apparel leftovers).
    const categoryOptions = await openSelectByPlaceholder(page, 'Select a category');
    await expect(categoryOptions.first()).toBeVisible();
    const names = await categoryOptions.allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).not.toMatch(APPAREL_TERMS);
    }
    await page.keyboard.press('Escape');

    // DESIGN DECISION (GAP-1 closed 2026-09-04) — client req 2.1 bullet 4 asks
    // for "Safety warnings & Dosage recommendations". Safety is a dedicated
    // field; dosage is deliberately NOT one: dosing guidance is authored in the
    // Usage Instructions free-text field. This assertion pins that contract so a
    // future schema/UI change that adds a real dosage field updates the docs too.
    await expect(page.getByLabel(/dosage/i)).toHaveCount(0);
    await expect(page.getByLabel('Usage Instructions')).toBeVisible();
  });

  test('2.1 validation: empty required fields block step 1', async ({ page }) => {
    await page.goto(`${BASE_URL}/inventory/new`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedForm(page);

    await page.getByRole('button', { name: 'Next: Variants' }).click();

    await expect(page.getByText('Product name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Category is required')).toBeVisible();

    // Blocked: never advanced to step 2.
    await expect(page.getByRole('heading', { name: 'Step 2: Variant Matrix' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/inventory\/new/);
  });

  test('2.1 validation: negative and invalid pricing is rejected', async ({ page }) => {
    await page.goto(`${BASE_URL}/inventory/new`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedForm(page);

    await page.getByLabel('Product Name').fill(`QA NegCheck ${RUN_ID}`);
    const categoryOptions = await openSelectByPlaceholder(page, 'Select a category');
    await categoryOptions.first().click();
    await page.getByRole('button', { name: 'Next: Variants' }).click();
    await expect(page.getByRole('heading', { name: 'Step 2: Variant Matrix' })).toBeVisible();
    await waitForHydratedForm(page);

    await addChip(page, 'Type a form (e.g. POWDER) and press Enter', 'POWDER');
    await addChip(page, 'Type a pack size (e.g. 75g, 200ml) and press Enter', '250g');
    await expect(page.locator('#sku-0')).toBeVisible();

    // HTML-level guard: money and stock inputs must not accept negatives.
    for (const id of ['#cost-0', '#retail-0', '#stock-0', '#low-0']) {
      await expect(page.locator(id)).toHaveAttribute('min', '0');
    }

    // Negative values are rejected by native constraint validation (min="0"),
    // which blocks submission before the wizard's own handler ever runs.
    await page.locator('#cost-0').fill('-100');
    await page.locator('#retail-0').fill('-50');
    const costValidity = await page.locator('#cost-0').evaluate((el) => {
      const input = el as HTMLInputElement;
      return { rangeUnderflow: input.validity.rangeUnderflow, valid: input.validity.valid };
    });
    expect(costValidity).toEqual({ rangeUnderflow: true, valid: false });

    await page.getByRole('button', { name: 'Next: Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review & Create' })).toHaveCount(0);

    // Empty pricing is caught by the wizard's own validation.
    await page.locator('#cost-0').fill('');
    await page.locator('#retail-0').fill('');
    await page.getByRole('button', { name: 'Next: Review' }).click();
    await expect(page.getByText(/must have a cost price greater than 0/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review & Create' })).toHaveCount(0);

    // Positive but retail below cost is rejected, with an inline warning.
    await page.locator('#cost-0').fill('500');
    await page.locator('#retail-0').fill('100');
    await expect(page.getByText('Retail is below cost')).toBeVisible();
    await page.getByRole('button', { name: 'Next: Review' }).click();
    await expect(page.getByText(/retail price must be .* cost price/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review & Create' })).toHaveCount(0);
  });

  test('2.1 creates a dynamic product with Ayurvedic fields and displays them', async ({
    page,
  }) => {
    product = await createProductViaWizard(page);

    expect(product.sku).toBeTruthy();

    await openProductDetail(page, product.name);

    // Guard against BUG-2: the API can answer 207 PARTIAL_SUCCESS (product
    // saved, variants rejected) while the wizard still reports plain success.
    await expect(page.getByText('No variants found')).toHaveCount(0);
    await page.getByRole('button', { name: 'Variants' }).click();
    await expect(page.getByRole('row').filter({ hasText: product.sku }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Details' }).click();

    // Details tab renders the Ayurvedic content that was captured.
    await expect(page.getByText('Active Ingredients')).toBeVisible();
    await expect(page.getByText('Ashwagandha root extract, Black pepper')).toBeVisible();
    await expect(page.getByText('Usage Instructions')).toBeVisible();
    await expect(page.getByText('Take 1 teaspoon twice daily after meals.')).toBeVisible();
    await expect(page.getByText('Safety Precautions')).toBeVisible();
    await expect(page.getByText('Not recommended during pregnancy.')).toBeVisible();
    await expect(page.getByText('Health Benefits')).toBeVisible();
    await expect(page.getByText('Supports stamina and reduces stress.')).toBeVisible();
  });

  test('BUG-2 pin: wizard duplicate-SKU submit shows PARTIAL_SUCCESS warning, not success', async ({
    page,
  }) => {
    test.skip(!product, 'depends on the create test (reuses its SKU)');

    // Drive the wizard manually — createProductViaWizard asserts the success
    // toast, which must NOT appear here: the SKU already belongs to the
    // fixture product, so the route answers 207 PARTIAL_SUCCESS.
    await page.goto(`${BASE_URL}/inventory/new`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedForm(page);
    await page.getByLabel('Product Name').fill(`QA DupWizard ${RUN_ID}`);
    const categoryOptions = await openSelectByPlaceholder(page, 'Select a category');
    await expect(categoryOptions.first()).toBeVisible();
    await categoryOptions.first().click();
    await page.getByRole('button', { name: 'Next: Variants' }).click();
    await expect(page.getByRole('heading', { name: 'Step 2: Variant Matrix' })).toBeVisible();
    await waitForHydratedForm(page);

    await addChip(page, 'Type a form (e.g. POWDER) and press Enter', 'POWDER');
    await addChip(page, 'Type a pack size (e.g. 75g, 200ml) and press Enter', '200g');
    const skuInput = page.locator('#sku-0');
    await expect(skuInput).toBeVisible();
    await skuInput.fill(product.sku); // forced duplicate → variant creation fails
    await page.locator('#stock-0').fill('10');
    await page.locator('#cost-0').fill('900');
    await page.locator('#retail-0').fill('1450');
    await page.locator('#low-0').fill('5');
    await page.getByRole('button', { name: 'Next: Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review & Create' })).toBeVisible();

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/store/products') && r.request().method() === 'POST',
      { timeout: 60_000 },
    );
    await page.getByRole('button', { name: 'Create Product' }).click();
    const res = await responsePromise;
    expect.soft(res.status(), 'BUG-2: duplicate-SKU submit → 207 PARTIAL_SUCCESS').toBe(207);

    // Cleanup first (best-effort): the product row WAS created — archive the
    // stray shell so the run leaves no unmanaged fixture behind.
    const resBody = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
    if (resBody?.data?.id) {
      await page.request.post(`/api/store/products/${resBody.data.id}/archive`).catch(() => {});
    }

    // The review step surfaces the warning banner (API message + guidance)…
    const alert = page.getByTestId('partial-success-warning');
    await expect(alert, 'BUG-2: warning banner replaces the success toast').toBeVisible({
      timeout: 15_000,
    });
    await expect(alert).toContainText('Product created but variant creation failed');
    await expect(alert).toContainText(/add variants from the product.s edit page/i);
    // …and the plain success toast is never shown.
    await expect(page.getByText('Product created successfully')).toHaveCount(0);
    // User is kept on the review step (no navigation to /inventory).
    await expect(page.getByRole('heading', { name: 'Review & Create' })).toBeVisible();
    await expect(page).toHaveURL(/\/inventory\/new/);
  });

  test('search: filters the inventory list by the dynamic product name', async ({ page }) => {
    test.skip(!product, 'depends on the create test');

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
    // GAP-4 (responsive duplicate input) was FIXED on web-refactor —
    // InventoryFilterBar.tsx renders exactly one search input (verified
    // 2026-09-15, M02-04). The visible-scoping below is now a harmless
    // belt-and-braces pattern, not a workaround.
    const search = page
      .getByPlaceholder('Search by name, SKU, or barcode…')
      .locator('visible=true')
      .first();
    await expect(search).toBeVisible({ timeout: 90_000 });
    await waitForHydratedForm(
      page,
      'input[placeholder="Search by name, SKU, or barcode…"]',
      90_000,
    );

    await search.fill(product.name);

    // Debounced search pushes ?search= onto the URL (spaces encoded as "+").
    await expect(page).toHaveURL(/[?&]search=/, { timeout: 30_000 });

    const rows = page.getByRole('row').filter({ hasText: product.name });
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    // The filter is not cosmetic: exactly one match and no non-matching rows.
    // Asserted atomically so the debounced refetch cannot leave stale indices.
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(`tbody tr:not(:has-text("${product.name}"))`)).toHaveCount(0);
  });

  test('edit: changing the variant retail price is reflected', async ({ page }) => {
    test.skip(!product, 'depends on the create test');

    await openProductDetail(page, product.name);

    await page.getByRole('button', { name: 'Variants' }).click();
    const variantRow = page.getByRole('row').filter({ hasText: product.sku }).first();
    await expect(variantRow).toBeVisible({ timeout: 15_000 });

    const updatedPrice = '1890';
    // The row's action button is an icon-only Pencil with no accessible name.
    await variantRow.locator('td').last().locator('button').first().click();
    await expect(page.getByRole('heading', { name: 'Edit Variant' })).toBeVisible();

    await page.getByLabel('Retail Price').fill(updatedPrice);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Reflected in the variants table after the mutation refetches.
    // Prices render thousands-separated, e.g. "Rs. 1,890.00".
    await expect(page.getByRole('row').filter({ hasText: product.sku }).first()).toContainText(
      /1[,\u00a0\s]?890\.00/,
      { timeout: 20_000 },
    );
  });

  test('1.5 low-stock alert fires at the reorder level and reaches the notification centre', async ({
    page,
  }) => {
    test.skip(!product, 'depends on the create test');

    // Created with initialStock 20 and lowStockThreshold 5, so removing 18
    // leaves 2 units — at or below the reorder level.
    await page.goto(`${BASE_URL}/stock-control/adjust`, { waitUntil: 'domcontentloaded' });
    // First visit compiles the route in dev, so allow a generous budget.
    await expect(page.getByRole('heading', { name: 'Manual Stock Adjustment' })).toBeVisible({
      timeout: 90_000,
    });
    await waitForHydratedForm(page, 'form', 90_000);

    await page.getByPlaceholder('Search products by name, SKU, or barcode…').fill(product.name);
    // The result button's accessible name also includes the category text.
    await page.getByRole('button', { name: product.name }).first().click();

    const variantOptions = await openSelectByPlaceholder(page, 'Select variant');
    await variantOptions.first().click();

    await page.getByRole('button', { name: 'Remove Stock' }).click();
    await page.getByPlaceholder('Enter quantity').fill('18');

    const reasonOptions = await openSelectByPlaceholder(page, 'Select a reason');
    await reasonOptions.filter({ hasText: 'Damaged' }).click();

    await page.getByRole('button', { name: 'Submit Adjustment' }).click();

    // The adjustment must genuinely apply before we assert on its side effects.
    await expect(page.getByText(/Stock updated from \d+ to \d+ units\./)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/is low on stock\. Current stock: 2$/).first()).toBeVisible({
      timeout: 30_000,
    });

    // The low-stock page now lists the variant against its threshold.
    await page.goto(`${BASE_URL}/stock-control/low-stock`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Low Stock Variants' })).toBeVisible();
    await expect(page.getByText(product.sku).first()).toBeVisible({ timeout: 30_000 });

    // The status filter on the inventory list agrees.
    await page.goto(`${BASE_URL}/inventory?status=low_stock`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('row').filter({ hasText: product.name }).first()).toBeVisible({
      timeout: 30_000,
    });

    // In-app notification centre received the LOW_STOCK_ALERT.
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(
      page.getByText(`${product.name} — ${product.sku} is low on stock`).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('item deactivation: archiving a product moves it out of the active list', async ({
    page,
  }) => {
    test.skip(!product, 'depends on the create test');

    await page.goto(`${BASE_URL}/inventory?search=${encodeURIComponent(product.name)}`, {
      waitUntil: 'domcontentloaded',
    });
    const row = page.getByRole('row').filter({ hasText: product.name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole('button', { name: `Archive ${product.name}` }).click();
    await expect(page.getByRole('button', { name: `Unarchive ${product.name}` })).toBeVisible({
      timeout: 30_000,
    });

    // Archived-only view shows it; the active view no longer does.
    await page.goto(`${BASE_URL}/inventory?status=archived`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('row').filter({ hasText: product.name }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Restore so the run leaves no deactivated fixtures behind.
    await page
      .getByRole('row')
      .filter({ hasText: product.name })
      .first()
      .getByRole('button', { name: `Unarchive ${product.name}` })
      .click();
    await expect(page.getByRole('button', { name: `Archive ${product.name}` })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('3.10 batch & expiry tracking screen is available', async ({ page }) => {
    await page.goto(`${BASE_URL}/inventory/batches`, { waitUntil: 'domcontentloaded' });

    // The page has no <h1>; its identity is the document title plus the
    // batch/expiry summary tiles. The labels are duplicated by hidden Radix
    // filter options, so match only the visible summary cards.
    await expect(page).toHaveTitle(/Batches & Expiry/);
    for (const tile of ['Total batches', 'Healthy', 'Expiring soon', 'Expired']) {
      await expect(page.getByText(tile).filter({ visible: true }).first()).toBeVisible({
        timeout: 90_000,
      });
    }
  });

  // Teardown: remove the fixture created above so repeat runs stay clean.
  test('cleanup: deletes the QA product', async ({ page }) => {
    test.skip(!product, 'depends on the create test');

    await page.goto(`${BASE_URL}/inventory?search=${encodeURIComponent(product.name)}`, {
      waitUntil: 'domcontentloaded',
    });
    const row = page.getByRole('row').filter({ hasText: product.name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole('button', { name: `Delete ${product.name}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Delete Product' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('row').filter({ hasText: product.name })).toHaveCount(0, {
      timeout: 30_000,
    });
  });
});

// ============================================================================
// MODULE 02 — FULL-SCOPE EXPANSION (2026-09-07)
// Per erp/docs/qa/QA_ROADMAP.md Module 02: the original spec above covers the wizard
// catalog surface only. This expansion covers the remaining module surface —
// import/export/csv-template, bulk-price-update, variants/barcode/search APIs,
// movements ledger, security/tenant isolation, chaos data and the 10-point QA
// spectrum — plus explicit re-verification pins for BUG-1 and BUG-2.
// All payloads target the real contracts inspected in src/app/api/store/*.
// Data is RUN-suffixed and archived in cleanup (Appendix C.7).
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

test.describe.serial('Module 2 expansion — API surface, security & chaos (2026-09-07)', () => {
  test.describe.configure({ timeout: 180_000 });

  const CASHIER = {
    email: 'cashier1@ayurpos.dev',
    password: 'cashier123!',
  } as const;

  const RUN = `m02x${Date.now().toString(36)}`.slice(-12);
  const state: {
    categoryId?: string;
    productId?: string;
    productIdNoVar?: string;
    sku?: string;
    variantSku?: string;
    barcode?: string;
    createdProductIds: string[];
  } = { createdProductIds: [] };

  const json = async (r: any): Promise<any> => {
    try {
      return await r.json();
    } catch {
      return null;
    }
  };
  const apiPost = (p: Page, url: string, data: any) =>
    p.request.post(url, { data, headers: { 'content-type': 'application/json' } });
  const pickId = (b: any): string | undefined =>
    b?.data?.id ?? b?.data?.product?.id ?? b?.product?.id ?? b?.id;

  async function login(page: Page, email: string, password: string) {
    // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
    // every helper login starts from a logged-out context.
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedForm(page);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    // CASHIER logins open an "Open POS" role-choice dialog (open in this/new
    // tab); choose "Open in this tab". Owners land on /dashboard directly.
    // The dialog can be slow under dev-compile, so race URL-vs-dialog.
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
    // page.request shares the session cookie with the browser context.
  }

  async function createCategoryViaApi(page: Page): Promise<string> {
    const res = await apiPost(page, '/api/store/categories', { name: `${RUN} cat` });
    if (res.ok()) {
      const id = pickId(await json(res));
      if (id) return id;
    }
    // Fall back to reusing an existing category (create flow is Module 04's
    // surface; Module 02 only needs a valid categoryId to create products).
    const list = await json(await page.request.get('/api/store/categories'));
    const first = pickArrayFirst(list);
    if (!first) throw new Error('No category available and creation failed');
    return first.id;
  }
  const pickArrayFirst = (b: any) =>
    (Array.isArray(b) ? b : b?.data ?? b?.items ?? b?.categories ?? [])[0];

  // ── §1 Functional & business logic ─────────────────────────────────────────

  test('E1 prerequisites: category available; product WITHOUT categoryId rejected', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    state.categoryId = await createCategoryViaApi(page);

    // Schema constraint (roadmap dependency #2): categoryId is required.
    const noCat = await apiPost(page, '/api/store/products', {
      name: `${RUN} nocat`,
    });
    expect(noCat.status(), 'missing categoryId → 4xx, never 5xx').toBeGreaterThanOrEqual(400);
    expect(noCat.status()).toBeLessThan(500);
  });

  test('E2 create product + variant via API; price round-trips exactly (LKR 2dp)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // CreateProductSchema contract (src/lib/validators/product.validators.ts):
    // name, categoryId + variantDefinitions[] with sku/retailPrice/costPrice.
    // NOTE: the schema key is `variantDefinitions`; a `variants` key is an
    // accepted alias since M02-02/BUG-19 (pinned by E22 below). Any OTHER
    // unknown top-level key is now rejected 400 VALIDATION_ERROR (.strict()).
    const retailPrice = 199.99;
    const res = await apiPost(page, '/api/store/products', {
      name: `${RUN} product`,
      categoryId: state.categoryId,
      variantDefinitions: [
        {
          sku: `${RUN}-SKU1`,
          form: 'POWDER',
          packSize: '100g',
          retailPrice,
          costPrice: 120.5,
          initialStock: 4,
          lowStockThreshold: 2,
        },
      ],
    });

    const body = await json(res);
    const created = body?.data?.product ?? body?.data;
    state.productId = created?.id ?? pickId(body);
    if (state.productId) state.createdProductIds.push(state.productId);
    state.sku = created?.variants?.[0]?.sku ?? `${RUN}-SKU1`;

    // The route may legitimately answer 207 PARTIAL_SUCCESS (BUG-2 surface);
    // accept 200/201/207 here — the BUG-2 pin below asserts the semantics.
    expect(
      [200, 201, 207],
      `product create status=${res.status()} body=${JSON.stringify(body).slice(0, 400)}`,
    ).toContain(res.status());
    expect(state.productId, 'productId resolved from response').toBeTruthy();

    if (state.productId) {
      const get = await json(await page.request.get(`/api/store/products/${state.productId}`));
      const detail = get?.data ?? get;
      const v = (detail?.variants ?? [])[0];
      const storedRetail = Number(v?.retailPrice ?? detail?.retailPrice ?? NaN);
      if (!Number.isNaN(storedRetail)) {
        expect(
          Math.round(storedRetail * 100),
          'retail 199.99 stored with no float drift',
        ).toBe(19999);
      }
    }
  });

  test('E3 variant lookup: barcode API miss-path + search API resolve variants', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.productId, 'depends on E2').toBeTruthy();

    // Barcode miss-path: format per BARCODE_PATTERN in the route (alnum + dash,
    // 8–20 chars) but unknown → 404 BARCODE_NOT_FOUND.
    const barcode = `QA${Date.now()}`.slice(0, 16);
    state.barcode = barcode;

    const miss = await page.request.get(`/api/store/variants/barcode/${barcode}`);
    expect(miss.status(), 'unknown barcode → 404 BARCODE_NOT_FOUND').toBe(404);
    const missBody = await json(miss);
    expect(missBody?.error?.code ?? missBody?.error?.message).toBeTruthy();

    const search = await page.request.get(
      `/api/store/variants/search?search=${encodeURIComponent(state.sku!)}`,
    );
    expect(search.status(), 'variant search reachable').toBeLessThan(500);
    const sBody = await json(search);
    const sText = JSON.stringify(sBody);
    expect.soft(sText, 'search returns the created SKU').toContain(state.sku!);
  });

  // ── §2 Financial precision ─────────────────────────────────────────────────

  test('E4 bulk-price-update +10% rounds half-up to 2dp (199.99 → 219.99)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.productId, 'depends on E2').toBeTruthy();

    const res = await apiPost(page, '/api/store/products/bulk-price-update', {
      productIds: [state.productId],
      mode: 'PERCENT',
      percentage: 10,
      direction: 'INCREASE',
      target: 'RETAIL',
    });
    expect(res.status(), 'bulk update accepted').toBeLessThan(300);

    const get = await json(await page.request.get(`/api/store/products/${state.productId}`));
    const detail = get?.data ?? get;
    const v = (detail?.variants ?? [])[0];
    const price = Number(v?.retailPrice ?? detail?.retailPrice ?? NaN);
    if (!Number.isNaN(price)) {
      expect(price, '199.99 * 1.1 = 219.989 → Math.round → 219.99').toBeCloseTo(219.99, 2);
    }
  });

  test('E5 bulk-price-update rejects negative/non-numeric/oversized values with 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    // Zod contract: percentage int 1..200; FIXED requires positive prices.
    const badPayloads = [
      { productIds: [state.productId], mode: 'PERCENT', percentage: -10, direction: 'INCREASE', target: 'RETAIL' },
      { productIds: [state.productId], mode: 'PERCENT', percentage: 'abc', direction: 'INCREASE', target: 'RETAIL' },
      { productIds: [state.productId], mode: 'PERCENT', percentage: 300, direction: 'INCREASE', target: 'RETAIL' },
      { productIds: [state.productId], mode: 'FIXED', costPrice: -5, retailPrice: 10 },
      { productIds: [state.productId], mode: 'FIXED' },
    ];
    for (const payload of badPayloads) {
      const res = await apiPost(page, '/api/store/products/bulk-price-update', payload);
      expect.soft(
        res.status(),
        `payload=${JSON.stringify(payload)} must be 400, got ${res.status()}`,
      ).toBe(400);
    }
  });

  // ── §3 Cross-module cascade & ledger ───────────────────────────────────────

  test('E6 movements ledger endpoint returns rows with reason + actor, none future-dated', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.productId, 'depends on E2').toBeTruthy();

    const res = await page.request.get(`/api/store/products/${state.productId}/movements`);
    expect(res.status(), 'movements endpoint reachable').toBeLessThan(500);
    const body = await json(res);
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    for (const row of rows.slice(0, 10)) {
      expect.soft(row.reason ?? row.type, 'ledger row carries a reason code').toBeTruthy();
      expect.soft(
        row.actor?.id ?? row.userId ?? row.actorId,
        'ledger row carries an actor (BUG-4 class regression guard)',
      ).toBeTruthy();
      const ts = Date.parse(row.createdAt ?? '');
      if (!Number.isNaN(ts)) {
        expect.soft(ts, 'no future-dated ledger rows').toBeLessThanOrEqual(Date.now() + 5 * 60_000);
      }
      break;
    }
  });

  // ── §4 Audit trail, soft delete & recoverable delete ───────────────────────

  test('E7 DELETE is a soft delete with a real restore path (M02-03 fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.categoryId, 'depends on E1').toBeTruthy();

    // Use a DEDICATED throwaway product so the E2 fixture is never touched.
    // initialStock 5 gives us a stock figure to re-verify after restore.
    const res = await apiPost(page, '/api/store/products', {
      name: `${RUN} deltarget`,
      categoryId: state.categoryId,
      variantDefinitions: [
        { sku: `${RUN}-DEL`, form: 'OIL', packSize: '10ml', retailPrice: 50, costPrice: 20, initialStock: 5, lowStockThreshold: 0 },
      ],
    });
    const body = await json(res);
    const delTarget = pickId(body);
    expect(delTarget, 'throwaway product created').toBeTruthy();

    // 1) archive toggle is a soft flag (isArchived), reversible.
    const archive = await apiPost(page, `/api/store/products/${delTarget}/archive`, {});
    expect(archive.status(), 'archive accepted').toBeLessThan(300);
    const archBody = await json(archive);
    expect.soft(archBody?.data?.isArchived, 'archive sets isArchived=true').toBe(true);
    const unarchive = await apiPost(page, `/api/store/products/${delTarget}/archive`, {});
    expect.soft(unarchive.status(), 'unarchive (toggle back) works').toBeLessThan(300);

    // 2) DELETE is a soft delete (deletedAt on product + variants) and the
    //    response now points at the REAL recovery path (M02-03 / D4 policy).
    const del = await page.request.delete(`/api/store/products/${delTarget}`);
    expect.soft(del.status(), 'DELETE accepted (soft delete)').toBe(200);
    const delBody = await json(del);
    expect.soft(
      JSON.stringify(delBody),
      'DELETE message names the Deleted filter, not raw-DB surgery',
    ).toContain('Deleted filter');

    // 3) Gone from the default list…
    const defaultRows = async () => {
      const b = await json(
        await page.request.get(`/api/store/products?search=${encodeURIComponent(`${RUN} deltarget`)}`),
      );
      return Array.isArray(b?.data) ? b.data : [];
    };
    expect.soft(
      (await defaultRows()).some((p: any) => p?.id === delTarget),
      'soft-deleted product absent from the default list',
    ).toBe(false);

    // 4) …but VISIBLE under the deleted filter (?status=deleted).
    const deletedList = await json(
      await page.request.get(
        `/api/store/products?status=deleted&search=${encodeURIComponent(`${RUN} deltarget`)}`,
      ),
    );
    const deletedRows: any[] = Array.isArray(deletedList?.data) ? deletedList.data : [];
    expect.soft(
      deletedRows.some((p: any) => p?.id === delTarget),
      'soft-deleted product listed under status=deleted',
    ).toBe(true);

    // 5) POST /restore brings it back, variants + stock intact.
    const restore = await page.request.post(`/api/store/products/${delTarget}/restore`);
    expect.soft(restore.status(), 'restore returns 200').toBe(200);
    expect.soft(
      (await defaultRows()).some((p: any) => p?.id === delTarget),
      'restored product back in the default list',
    ).toBe(true);
    const detail = await json(await page.request.get(`/api/store/products/${delTarget}`));
    const restoredVariant = (detail?.data?.variants ?? [])[0];
    expect.soft(restoredVariant?.sku, 'variant intact after restore').toBe(`${RUN}-DEL`);
    expect.soft(restoredVariant?.stockQuantity, 'stock unchanged across delete/restore').toBe(5);

    // 6) Second restore is an honest 409 (idempotency guard), not a silent no-op.
    const again = await page.request.post(`/api/store/products/${delTarget}/restore`);
    expect.soft(again.status(), 'restore of a live product → 409').toBe(409);
    const againBody = await json(again);
    expect.soft(
      againBody?.error?.message,
      '409 explains the product is not deleted',
    ).toContain('not deleted');
  });

  // ── §5 Chaos, button spam & race conditions ────────────────────────────────

  test('E8 duplicate SKU variant creation rejected without 500 (race guard)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.productId, 'depends on E2').toBeTruthy();

    // Re-POST the identical variant payload — the SKU already exists from E2.
    // The variants sub-route takes a BARE ARRAY (verified against its route).
    const res = await apiPost(page, `/api/store/products/${state.productId}/variants`, [
      {
        sku: state.sku,
        form: 'POWDER',
        packSize: '100g',
        retailPrice: 199.99,
        costPrice: 120.5,
        initialStock: 0,
        lowStockThreshold: 0,
      },
    ]);
    expect.soft(res.status(), 'duplicate SKU must not 500').toBeLessThan(500);
    expect.soft(res.status(), 'duplicate SKU must not silently succeed').toBeGreaterThanOrEqual(400);
  });

  // ── §6 Hardware / device simulation ────────────────────────────────────────

  test('E9 barcode-scanner keystroke burst resolves product in list search', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.sku, 'depends on E2').toBeTruthy();

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
    // Scope to the visible search input (responsive duplicate renders two).
    const search = page
      .getByPlaceholder('Search by name, SKU, or barcode…')
      .locator('visible=true')
      .first();
    await expect(search).toBeVisible({ timeout: 90_000 });
    await waitForHydratedForm(page, 'input[placeholder="Search by name, SKU, or barcode…"]', 90_000);

    // Simulate a hardware scanner: rapid keystroke burst terminated by Enter.
    await search.click();
    await page.keyboard.type(state.sku!, { delay: 2 });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]search=/, { timeout: 30_000 });
    // The list row shows the product name; the SKU may only appear in the
    // variants count column — assert on the product name instead.
    await expect(
      page.getByRole('row').filter({ hasText: `${RUN} product` }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  // ── §7 Network resilience ──────────────────────────────────────────────────

  test('E10 products API 500 → inventory page degrades gracefully (no white-screen)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/products?**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: { code: 'INTERNAL_SERVER_ERROR' } }) }),
    );
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length, 'page still renders content').toBeGreaterThan(50);
    const pageError: string[] = [];
    page.on('pageerror', (e) => pageError.push(e.message));
    await page.waitForTimeout(500);
    expect(
      pageError.length,
      `uncaught page errors: ${pageError.join(' | ')}`,
    ).toBe(0);
    await page.unroute('**/api/store/products?**');
  });

  // ── §8 Security, RBAC & tenant isolation ───────────────────────────────────

  test('E11 unauthenticated product mutation → 401', async ({ page }) => {
    // Brand-new browser context = no session cookie.
    const browser = page.context().browser()!;
    const ctx = await browser.newContext();
    const fresh = await ctx.request.post('/api/store/products', {
      data: { name: 'anon product', categoryId: state.categoryId },
      headers: { 'content-type': 'application/json' },
    });
    expect([401, 403], 'anon product create blocked').toContain(fresh.status());
    const anonGet = await ctx.request.get('/api/store/products');
    expect([401, 403], 'anon product read blocked').toContain(anonGet.status());
    await ctx.close();
  });

  test('E12 CASHIER cannot create/modify products (least privilege)', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const res = await apiPost(page, '/api/store/products', {
      name: `${RUN} cashier`,
      categoryId: state.categoryId,
      variants: [],
    });
    expect([401, 403], `cashier create blocked, got ${res.status()}`).toContain(res.status());
  });

  test('E13 products list is tenant-scoped (no cross-tenant leakage)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const body = await json(await page.request.get('/api/store/products?limit=100'));
    const rows = Array.isArray(body?.data?.products)
      ? body.data.products
      : Array.isArray(body?.data)
        ? body.data
        : [];
    const tenantIds = new Set<string>();
    const walk = (o: any) => {
      if (!o || typeof o !== 'object') return;
      if (typeof o.tenantId === 'string') tenantIds.add(o.tenantId);
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
    };
    rows.forEach(walk);
    expect(
      tenantIds.size,
      `owner list must be single-tenant, saw ${JSON.stringify([...tenantIds])}`,
    ).toBeLessThanOrEqual(1);
  });

  // ── §9 Boundary inputs & chaos data ────────────────────────────────────────

  test('E14 Sinhala/Tamil/emoji product name round-trips intact', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const uniName = `${RUN} ඇඳ ශාක ෂධ සකුරු மூலிகை 🌿✨`;
    const res = await apiPost(page, '/api/store/products', {
      name: uniName,
      categoryId: state.categoryId,
      variants: [],
    });
    expect.soft(res.status(), 'unicode create < 300').toBeLessThan(300);
    const id = pickId(await json(res));
    if (id) state.createdProductIds.push(id);
    if (id) {
      const back = JSON.stringify(await json(await page.request.get(`/api/store/products/${id}`)));
      expect.soft(back, 'Sinhala preserved').toContain('ඇඳ');
      expect.soft(back, 'emoji preserved').toContain('🌿');
    }
  });

  test('E15 XSS product name never executes in the inventory UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    let dialogFired = false;
    page.on('dialog', async (d) => {
      dialogFired = true;
      await d.dismiss();
    });
    const xssName = `${RUN} <script>window.__m02xss=1</script><img src=x onerror="window.__m02xss=1">`;
    const res = await apiPost(page, '/api/store/products', {
      name: xssName,
      categoryId: state.categoryId,
      variants: [],
    });
    const id = pickId(await json(res));
    if (id) state.createdProductIds.push(id);

    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const exec = await page.evaluate(() => (window as any).__m02xss ?? null);
    expect(exec, 'script payload must NOT execute').toBeNull();
    expect(dialogFired, 'no alert dialogs from stored XSS').toBe(false);
  });

  test('E16 hostile numeric prices never 500 (zero/negative/overflow)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const [i, price] of [0, -1, 1e15, Number.MAX_SAFE_INTEGER + 1, 'NaN'].entries()) {
      const res = await apiPost(page, '/api/store/products', {
        name: `${RUN} hostile-${i}`,
        categoryId: state.categoryId,
        variants: [
          {
            sku: `${RUN}-H${i}`,
            form: 'POWDER',
            packSize: '1g',
            retailPrice: price as never,
            costPrice: price as never,
            initialStock: 0,
            lowStockThreshold: 0,
          },
        ],
      });
      expect.soft(res.status(), `price=${price} → not 500`).toBeLessThan(500);
      const id = pickId(await json(res));
      if (id && res.status() < 300) state.createdProductIds.push(id);
    }
  });

  test('E17 1000-char product name handled without 500', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await apiPost(page, '/api/store/products', {
      name: 'X'.repeat(1000) + RUN,
      categoryId: state.categoryId,
      variants: [],
    });
    expect.soft(res.status(), 'long name not 500').toBeLessThan(500);
    const id = pickId(await json(res));
    if (id && res.status() < 300) state.createdProductIds.push(id);
  });

  // ── §10 Time-travel & retroactive date handling ────────────────────────────

  test('E18 client-supplied createdAt cannot backdate a product', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await apiPost(page, '/api/store/products', {
      name: `${RUN} timetravel`,
      categoryId: state.categoryId,
      createdAt: '1999-01-01T00:00:00.000Z',
      variants: [],
    });
    // M02-02 (BUG-19 strictness flip): CreateProductSchema is now .strict(),
    // so a forged `createdAt` — an unknown top-level key — is rejected
    // outright instead of being silently dropped; the backdate attempt never
    // reaches the create path.
    expect.soft(res.status(), 'create with forged createdAt → 400 (strict)').toBe(400);
    const body = await json(res);
    expect.soft(body?.error?.code, '400 carries VALIDATION_ERROR').toBe('VALIDATION_ERROR');
  });

  // ── Import / export / csv-template surface ─────────────────────────────────

  test('E19 csv-template + export endpoints respond with content', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const tpl = await page.request.get('/api/store/products/csv-template');
    expect(tpl.status(), 'csv-template reachable').toBeLessThan(500);
    const tplText = await tpl.text();
    expect(tplText.length, 'template non-empty').toBeGreaterThan(10);

    const exp = await page.request.get('/api/store/products/export');
    expect(exp.status(), 'export reachable').toBeLessThan(500);
    expect((await exp.text()).length, 'export non-empty').toBeGreaterThan(10);
  });

  test('E20 import: valid row succeeds; invalid row rejected without 500 (BUG-2 pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // ImportPayloadSchema: rows[] with productName/category/retailPrice (positive).
    const okRes = await apiPost(page, '/api/store/products/import', {
      rows: [
        {
          productName: `${RUN} import-ok`,
          category: 'QA Import Cat',
          retailPrice: 150.0,
          sku: `${RUN}-IMP1`,
          form: 'POWDER',
          packSize: '50g',
        },
      ],
    });
    expect.soft(okRes.status(), 'valid import row accepted').toBeLessThan(300);
    const okBody = await json(okRes);
    // BUG-2 semantics: a partial result must NOT be presented as plain success.
    if (okRes.status() === 207) {
      const text = JSON.stringify(okBody);
      expect.soft(text, '207 must carry PARTIAL_SUCCESS warning (BUG-2)').toMatch(/PARTIAL|warning|fail|error/i);
    }

    const badRes = await apiPost(page, '/api/store/products/import', {
      rows: [
        {
          productName: `${RUN} import-bad`,
          category: 'QA Import Cat',
          retailPrice: -5,
        },
      ],
    });
    expect.soft(badRes.status(), 'negative retailPrice rejected 4xx').toBeGreaterThanOrEqual(400);
    expect.soft(badRes.status(), 'negative retailPrice never 500').toBeLessThan(500);
  });

  test('E21 BUG-1 pin: inventory table headers internally consistent (Variants, no Gender)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 90_000 });
    const headers = (await page.locator('table th').allInnerTexts()).map((h) => h.trim());
    test.info().annotations.push({ type: 'info', description: `INVENTORY HEADERS: ${JSON.stringify(headers)}` });
    // BUG-1 fixed by M02-01: the leftover apparel "Gender" header was renamed
    // to "Variants" (the cell renders product._count.variants). Headers are
    // CSS-uppercased, so match case-insensitively.
    expect.soft(
      headers.some((h) => /gender/i.test(h)),
      'BUG-1: no "Gender" header',
    ).toBe(false);
    expect.soft(
      headers.some((h) => /^variants$/i.test(h)),
      'M02-01: a "Variants" header is present',
    ).toBe(true);
    // The selection column legitimately has no text (it holds the aria-labelled
    // "Select all products" checkbox) — at most one blank header is allowed.
    expect.soft(headers.filter((h) => !h).length, 'only the checkbox column is blank').toBeLessThanOrEqual(1);
    expect.soft(
      headers.filter((h, i) => h && headers.indexOf(h) !== i),
      'no duplicated headers',
    ).toEqual([]);
  });

  // ── BUG-19 (M02-02): variants alias + strict unknown-key rejection ────────

  test('E22 BUG-19 pin: variants[] alias creates variants; unknown top-level key → 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    expect(state.categoryId, 'depends on E1').toBeTruthy();

    // Alias face: `variants` maps to `variantDefinitions` — the variant must
    // actually be created (pre-fix: silent 201 with ZERO variants).
    const aliasRes = await apiPost(page, '/api/store/products', {
      name: `${RUN} alias-variants`,
      categoryId: state.categoryId,
      variants: [
        { sku: `${RUN}-ALIAS`, form: 'POWDER', packSize: '100g', retailPrice: 120, costPrice: 60, initialStock: 3, lowStockThreshold: 1 },
      ],
    });
    const aliasBody = await json(aliasRes);
    const aliasId = pickId(aliasBody);
    if (aliasId) state.createdProductIds.push(aliasId);
    expect.soft(aliasRes.status(), `alias create accepted, got ${aliasRes.status()}`).toBeLessThan(300);
    expect.soft(aliasId, 'alias create returned a product id').toBeTruthy();
    if (aliasId) {
      const detail = await json(await page.request.get(`/api/store/products/${aliasId}`));
      const skus: string[] = ((detail?.data ?? detail)?.variants ?? []).map((v: any) => v?.sku);
      expect.soft(skus, '`variants` alias actually created the variant').toContain(`${RUN}-ALIAS`);
    }

    // Strict face: an unrelated unknown top-level key is rejected, not stripped.
    const bogusRes = await apiPost(page, '/api/store/products', {
      name: `${RUN} bogus-key`,
      categoryId: state.categoryId,
      bogusKey: 1,
    });
    expect.soft(bogusRes.status(), 'unknown top-level key → 400').toBe(400);
    const bogusBody = await json(bogusRes);
    expect.soft(bogusBody?.error?.code, '400 carries VALIDATION_ERROR').toBe('VALIDATION_ERROR');
  });

  // ── Cleanup (Appendix C.7) ─────────────────────────────────────────────────

  test('cleanup: archives every RUN-created product via API', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const id of [...new Set(state.createdProductIds)]) {
      await page.request.post(`/api/store/products/${id}/archive`).catch(() => {});
    }
  });
});
