import { test, expect, type Page } from '@playwright/test';

/**
 * 37_barcode_printing.spec.ts — MODULE 37: Barcode printing (Inventory)
 *
 * Client requirement: a "Barcode printing" page under Inventory where products
 * can be queued onto A4 sheets, previewed page by page, and printed; every
 * product — including the demo catalog — must already carry a saved barcode,
 * and newly created products must get one automatically.
 *
 * Coverage:
 *   • 37.1 navigation + empty state
 *   • 37.2 demo catalog already has saved, unique EAN-13 barcodes
 *   • 37.3 queue → preview → copies → extra A4 pages → fill last sheet
 *   • 37.4 Print A4 emits one printable page per sheet
 *   • 37.5 create a product in the wizard → barcode generated, saved and scannable
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

const OWNER = {
  email: 'owner@dilani-ayurwellness.lk',
  password: 'owner123!',
} as const;

const RUN_ID = `${Date.now().toString(36)}${process.env.TEST_WORKER_INDEX ?? '0'}`.slice(-6);

type PrintStats = { pages: number; labels: number; svgs: number } | null;
type PrintWindow = Window & { __printStats?: PrintStats };

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function loginAsOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedForm(page);
  await page.getByLabel('Email address').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

async function openSelectByPlaceholder(page: Page, placeholder: string) {
  await page.locator(`button:has-text("${placeholder}")`).first().click();
  return page.getByRole('option');
}

async function addChip(page: Page, placeholder: string, value: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(value);
  await input.press('Enter');
}

/** GS1 check-digit validation, independent of the app's own implementation. */
function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10) === value[12];
}

async function gotoBarcodePrinting(page: Page) {
  await page.goto(`${BASE_URL}/inventory/barcode-printing`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { name: 'Barcode Printing' })).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * The barcode's human-readable digits render as separate SVG text spans, so
 * innerText inserts line breaks between them. Compare with whitespace stripped.
 */
async function expectLabelContainsBarcode(page: Page, barcode: string) {
  const label = page.getByTestId('barcode-sheet-label').first();
  await expect(label).toBeVisible();
  const text = (await label.innerText()).replace(/\s+/g, '');
  expect(text).toContain(barcode);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe.serial('Module 37 — Barcode Printing', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test('37.1 Inventory navigation exposes Barcode Printing and the workspace is empty', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });

    const navLink = page.getByRole('link', { name: 'Barcode Printing' }).first();
    await expect(navLink).toBeVisible({ timeout: 30_000 });
    expect(await navLink.getAttribute('href')).toBe('/inventory/barcode-printing');

    await navLink.click();
    await expect(page).toHaveURL(/\/inventory\/barcode-printing/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Barcode Printing' })).toBeVisible();

    // Nothing queued: no pages, print disabled, guidance shown on the sheet.
    await expect(page.getByTestId('barcode-total-labels')).toHaveText('0');
    await expect(page.getByTestId('barcode-page-count')).toHaveText('No pages yet');
    await expect(page.getByRole('button', { name: 'Print A4' })).toBeDisabled();
    await expect(page.getByText('The A4 sheet fills as you add products.')).toBeVisible();
  });

  test('37.2 demo products already carry saved, unique EAN-13 barcodes', async ({ page }) => {
    const res = await page.request.get(
      `${BASE_URL}/api/store/products?status=active&limit=100`,
    );
    expect(res.ok()).toBe(true);
    const json = (await res.json()) as {
      data: Array<{ name: string; variants?: Array<{ sku: string; barcode: string | null }> }>;
    };

    const variants = json.data.flatMap((product) =>
      (product.variants ?? []).map((variant) => ({ ...variant, productName: product.name })),
    );
    expect(variants.length).toBeGreaterThanOrEqual(10);

    const seen = new Set<string>();
    for (const variant of variants) {
      expect(variant.barcode, `${variant.sku} has no saved barcode`).toBeTruthy();
      const barcode = variant.barcode!;
      expect(isValidEan13(barcode), `${barcode} is not a valid EAN-13`).toBe(true);
      expect(seen.has(barcode), `duplicate barcode ${barcode}`).toBe(false);
      seen.add(barcode);
    }

    // The seeded demo variant used by the rest of this spec sees the same value
    // the printer will render.
    const demo = variants.find((variant) => variant.sku === 'BAI-08-OIL-100ML');
    expect(demo?.barcode).toBeTruthy();

    await gotoBarcodePrinting(page);
    await page.getByTestId('barcode-product-search').fill('BAI-08-OIL-100ML');
    const row = page
      .getByTestId('barcode-result-row')
      .filter({ hasText: 'BAI-08-OIL-100ML' })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(demo!.barcode!);

    await row.getByRole('button', { name: 'Add BAI-08-OIL-100ML' }).click();
    await expect(page.getByTestId('barcode-sheet-label')).toHaveCount(1);
    await expectLabelContainsBarcode(page, demo!.barcode!);
  });

  test('37.3 copies fill A4 pages and extra labels spill onto another sheet', async ({
    page,
  }) => {
    await gotoBarcodePrinting(page);

    await page.getByTestId('barcode-product-search').fill('BAI-08-OIL-100ML');
    const row = page
      .getByTestId('barcode-result-row')
      .filter({ hasText: 'BAI-08-OIL-100ML' })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: 'Add BAI-08-OIL-100ML' }).click();

    // One variant, one copy → one label on one sheet.
    await expect(page.getByTestId('barcode-total-labels')).toHaveText('1');
    await expect(page.getByTestId('barcode-page-count')).toHaveText('Page 1 of 1');

    // Exactly one full sheet.
    const copies = page.getByRole('spinbutton', { name: 'Copies for BAI-08-OIL-100ML' });
    await copies.fill('24');
    await expect(page.getByTestId('barcode-total-labels')).toHaveText('24');
    await expect(page.getByTestId('barcode-sheet-label')).toHaveCount(24);
    await expect(page.getByTestId('barcode-sheet-page')).toHaveCount(1);

    // One more label is enough to start a second A4 sheet.
    await copies.fill('25');
    await expect(page.getByTestId('barcode-total-labels')).toHaveText('25');
    await expect(page.getByTestId('barcode-sheet-page')).toHaveCount(2);
    await expect(page.getByTestId('barcode-sheet-label')).toHaveCount(25);
    await expect(page.getByTestId('barcode-page-count')).toHaveText('Page 1 of 2');

    // "Fill the last sheet" repeats the queue until the final page is full.
    await page.getByRole('switch', { name: 'Fill last sheet' }).click();
    await expect(page.getByTestId('barcode-total-labels')).toHaveText('48');
    await expect(page.getByTestId('barcode-sheet-page')).toHaveCount(2);
    await expect(page.getByTestId('barcode-sheet-label')).toHaveCount(48);

    // Removing the variant empties the worksheet again.
    await page.getByRole('button', { name: 'Remove BAI-08-OIL-100ML' }).click();
    await expect(page.getByTestId('barcode-total-labels')).toHaveText('0');
    await expect(page.getByTestId('barcode-sheet-page')).toHaveCount(0);
  });

  test('37.4 Print A4 emits one printable page per sheet', async ({ page }) => {
    await gotoBarcodePrinting(page);

    await page.getByTestId('barcode-product-search').fill('BAI-08-OIL-100ML');
    const row = page
      .getByTestId('barcode-result-row')
      .filter({ hasText: 'BAI-08-OIL-100ML' })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: 'Add BAI-08-OIL-100ML' }).click();
    await page.getByRole('spinbutton', { name: 'Copies for BAI-08-OIL-100ML' }).fill('25');

    // Capture the print overlay instead of opening the OS print dialog.
    await page.evaluate(() => {
      const win = window as PrintWindow;
      win.__printStats = null;
      window.print = () => {
        const root = document.querySelector('.shipping-label-print-root');
        win.__printStats = {
          pages: root?.querySelectorAll('[data-testid="barcode-sheet-page"]').length ?? 0,
          labels: root?.querySelectorAll('[data-testid="barcode-sheet-label"]').length ?? 0,
          svgs: root?.querySelectorAll('svg').length ?? 0,
        };
      };
    });

    await page.getByRole('button', { name: 'Print A4' }).click();

    await expect
      .poll(() => page.evaluate(() => (window as PrintWindow).__printStats))
      .toMatchObject({ pages: 2, labels: 25 });
    const stats = await page.evaluate(() => (window as PrintWindow).__printStats);
    expect(stats?.svgs).toBe(25);
  });

  test('37.5 a newly created product gets a barcode saved automatically', async ({ page }) => {
    const name = `QA Barcode ${RUN_ID}`;
    const sku = `QA-BC-${RUN_ID}`;

    await page.goto(`${BASE_URL}/inventory/new`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedForm(page);

    await page.getByLabel('Product Name').fill(name);
    const categories = await openSelectByPlaceholder(page, 'Select a category');
    await expect(categories.first()).toBeVisible();
    await categories.first().click();

    await page.getByRole('button', { name: 'Next: Variants' }).click();
    await expect(page.getByRole('heading', { name: 'Step 2: Variant Matrix' })).toBeVisible();
    await waitForHydratedForm(page);

    await addChip(page, 'Type a form (e.g. POWDER) and press Enter', 'POWDER');
    await addChip(page, 'Type a pack size (e.g. 75g, 200ml) and press Enter', '100g');

    // Deliberately leave Barcode blank: the server must generate and persist it.
    await page.locator('#sku-0').fill(sku);
    await page.locator('#stock-0').fill('5');
    await page.locator('#cost-0').fill('300');
    await page.locator('#retail-0').fill('600');
    await page.locator('#low-0').fill('5');

    await page.getByRole('button', { name: 'Next: Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review & Create' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Product' }).click();
    await expect(page.getByText('Product created successfully')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/inventory/, { timeout: 30_000 });

    // The saved variant carries a generated EAN-13.
    const productRes = await page.request.get(
      `${BASE_URL}/api/store/products?search=${encodeURIComponent(sku)}&limit=10`,
    );
    expect(productRes.ok()).toBe(true);
    const productJson = (await productRes.json()) as {
      data: Array<{
        id: string;
        name: string;
        variants?: Array<{ sku: string; barcode: string | null }>;
      }>;
    };
    const created = productJson.data.find((product) => product.name === name);
    expect(created).toBeTruthy();
    const barcode = created!.variants?.[0]?.barcode;
    expect(barcode, 'product was saved without a barcode').toBeTruthy();
    expect(isValidEan13(barcode!), `${barcode} is not a valid EAN-13`).toBe(true);

    // The generated barcode resolves at the POS lookup endpoint (scannable).
    const lookup = await page.request.get(
      `${BASE_URL}/api/store/variants/barcode/${barcode}`,
    );
    expect(lookup.status()).toBe(200);
    const lookupJson = (await lookup.json()) as { data: { sku: string; barcode: string } };
    expect(lookupJson.data.sku).toBe(sku);
    expect(lookupJson.data.barcode).toBe(barcode);

    // It is immediately printable on the barcode-printing page.
    await gotoBarcodePrinting(page);
    await page.getByTestId('barcode-product-search').fill(sku);
    const row = page
      .getByTestId('barcode-result-row')
      .filter({ hasText: sku })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(barcode!);
    await row.getByRole('button', { name: `Add ${sku}` }).click();
    await expectLabelContainsBarcode(page, barcode!);

    // Clean up: soft-delete the QA product so repeat runs stay clean.
    const del = await page.request.delete(`${BASE_URL}/api/store/products/${created!.id}`);
    expect(del.ok()).toBe(true);
  });

  test('37.6 product picker is server-paginated (10/page, newest first) and shows thumbnails', async ({
    page,
  }) => {
    const createdIds: string[] = [];

    try {
      // Make the test independent of catalogue size: ensure at least two pages.
      const initial = await page.request
        .get(`${BASE_URL}/api/store/products?status=active&limit=1&page=1`)
        .then((res) => res.json());
      const needed = Math.max(0, 11 - (initial.meta.total as number));
      if (needed > 0) {
        const categories = await page.request
          .get(`${BASE_URL}/api/store/categories`)
          .then((res) => res.json());
        const categoryId = categories.data?.[0]?.id as string;
        expect(categoryId, 'a seeded category exists').toBeTruthy();

        for (let index = 0; index < needed; index += 1) {
          const created = await page.request.post(`${BASE_URL}/api/store/products`, {
            data: {
              name: `QA Paging ${RUN_ID} ${index}`,
              categoryId,
              taxRule: 'EXEMPT',
              variantDefinitions: [
                {
                  sku: `QA-PG-${RUN_ID}-${index}`,
                  costPrice: 10,
                  retailPrice: 100,
                  initialStock: 1,
                },
              ],
            },
          });
          expect(created.status(), 'paging fixture created').toBe(201);
          const json = await created.json();
          createdIds.push(json.data.id as string);
        }
      }

      // Backend contract: 10 products per page, newest first, with page metadata.
      const firstJson = await page.request
        .get(`${BASE_URL}/api/store/products?status=active&limit=10&page=1`)
        .then((res) => res.json());
      const total = firstJson.meta.total as number;
      const totalPages = firstJson.meta.totalPages as number;
      const firstPage = firstJson.data as Array<{ name: string; createdAt: string }>;

      expect(firstJson.meta.limit).toBe(10);
      expect(firstPage.length).toBe(10);
      expect(totalPages).toBe(Math.ceil(total / 10));
      expect(totalPages).toBeGreaterThan(1);
      const times = firstPage.map((product) => new Date(product.createdAt).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));

      await gotoBarcodePrinting(page);
      await expect(page.getByTestId('barcode-products-page')).toHaveText(
        `Page 1 of ${totalPages}`,
      );
      await expect(page.getByTestId('barcode-products-range')).toContainText(`of ${total}`);
      await expect(page.getByTestId('barcode-result-row').first()).toContainText(
        firstPage[0]!.name,
      );

      const secondPage = await page.request
        .get(`${BASE_URL}/api/store/products?status=active&limit=10&page=2`)
        .then((res) => res.json())
        .then((json) => json.data as Array<{ name: string }>);

      await page.getByRole('button', { name: 'Next products page' }).click();
      await expect(page.getByTestId('barcode-products-page')).toHaveText(
        `Page 2 of ${totalPages}`,
      );
      await expect(page.getByTestId('barcode-result-row').first()).toContainText(
        secondPage[0]!.name,
      );
      await page.getByRole('button', { name: 'Previous products page' }).click();
      await expect(page.getByTestId('barcode-products-page')).toHaveText(
        `Page 1 of ${totalPages}`,
      );

      // A seeded product with an image renders its thumbnail in the picker.
      await page.getByTestId('barcode-product-search').fill('BAI-08-OIL-100ML');
      const imageRow = page
        .getByTestId('barcode-result-row')
        .filter({ hasText: 'BAI-08-OIL-100ML' })
        .first();
      await expect(imageRow.locator('img')).toBeVisible({ timeout: 30_000 });
    } finally {
      for (const id of createdIds) {
        await page.request.delete(`${BASE_URL}/api/store/products/${id}`);
      }
    }
  });
});
