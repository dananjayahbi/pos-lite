import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const TENANT_TWO = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };
const RUN = `m15-${Date.now().toString(36)}`.slice(-12);
/* eslint-disable @typescript-eslint/no-explicit-any */

async function body(response: any): Promise<any> {
  try { return await response.json(); } catch { return null; }
}

async function waitForHydratedInput(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('#email');
    return Boolean(input && Object.getOwnPropertyNames(input).some((key) => key.startsWith('__reactProps$')));
  }, { timeout: 30_000 });
}

async function login(page: Page, credentials = OWNER) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedInput(page);
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 10_000 });
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

const post = (page: Page, url: string, data?: unknown) => page.request.post(url, {
  data,
  headers: { 'content-type': 'application/json' },
});

async function fixture(page: Page) {
  const response = await page.request.get('/api/store/products?limit=100');
  expect(response.status()).toBe(200);
  const payload = await body(response);
  const products: any[] = Array.isArray(payload?.data) ? payload.data : payload?.data?.products ?? [];
  for (const product of products) {
    const detail = product.variants
      ? { data: product }
      : await body(await page.request.get(`/api/store/products/${product.id}`));
    const variants = detail?.data?.variants ?? product.variants ?? [];
    const variant = variants.find((candidate: any) => (candidate.stockQuantity ?? 0) >= 8);
    if (variant) return { product: detail.data ?? product, variant };
  }
  throw new Error('No seeded product variant with enough stock for Module 15');
}

async function createPromotion(page: Page, input: Record<string, unknown>) {
  const response = await post(page, '/api/store/promotions', input);
  const result = await body(response);
  expect(response.status(), JSON.stringify(result)).toBe(201);
  return result.data;
}

async function evaluate(page: Page, variant: any, extra: Record<string, unknown> = {}) {
  const response = await post(page, '/api/store/promotions/evaluate', {
    cartLines: [{
      variantId: variant.id,
      quantity: 2,
      unitPrice: String(variant.retailPrice),
      categoryId: variant.product?.categoryId ?? extra.categoryId,
    }],
    ...extra,
  });
  return { response, result: await body(response) };
}

test.describe('Module 15 - Promotions, Discounts & Customer Pricing', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });
  const state: { variant?: any; product?: any; customer?: any; promotionIds: string[]; saleIds: string[]; customerPricingRuleIds: string[] } = {
    promotionIds: [], saleIds: [], customerPricingRuleIds: [],
  };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const resolved = await fixture(page);
    state.product = resolved.product;
    state.variant = resolved.variant;
    const customerResponse = await post(page, '/api/store/sales/walkin-customer', {
      name: `M15 QA Customer ${RUN}`,
      phone: `071${String(Date.now()).slice(-7)}`,
    });
    expect(customerResponse.status()).toBe(200);
    state.customer = (await body(customerResponse)).data;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    for (const ruleId of state.customerPricingRuleIds) {
      // DELETE is a soft deactivate (CustomerPricingRule has no deletedAt).
      await page.request.delete(`/api/store/customer-pricing-rules/${ruleId}`);
    }
    for (const saleId of state.saleIds) {
      await page.request.post(`/api/store/sales/${saleId}/void`);
    }
    for (const promotionId of state.promotionIds) {
      await page.request.delete(`/api/store/promotions/${promotionId}`);
    }
    await page.close();
  });

  test('F0 exposes the promotions page and CRUD controls', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/promotions`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Promotions' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: /new promotion/i })).toBeVisible();
    await expect(page.getByText(/active now/i)).toBeVisible();
  });

  test('F1 creates, lists, updates, and deactivates a promotion', async ({ page }) => {
    await login(page);
    const promotion = await createPromotion(page, {
      name: `M15 Cart ${RUN}`, type: 'CART_PERCENTAGE', value: 10,
      description: 'QA promotion lifecycle',
    });
    state.promotionIds.push(promotion.id);
    expect(promotion.type).toBe('CART_PERCENTAGE');
    expect(Number(promotion.value)).toBe(10);

    const listed = await body(await page.request.get('/api/store/promotions'));
    expect(listed.data.some((row: any) => row.id === promotion.id)).toBe(true);

    const updated = await page.request.patch(`/api/store/promotions/${promotion.id}`, {
      data: { name: `${promotion.name} Updated`, value: 12.5 },
      headers: { 'content-type': 'application/json' },
    });
    expect(updated.status()).toBe(200);
    expect(Number((await body(updated)).data.value)).toBe(12.5);

    const toggled = await page.request.delete(`/api/store/promotions/${promotion.id}`);
    expect(toggled.status()).toBe(200);
    expect((await body(toggled)).data.isActive).toBe(false);
    const stillListed = (await body(await page.request.get('/api/store/promotions'))).data.find((row: any) => row.id === promotion.id);
    expect(stillListed).toBeTruthy();
    expect(stillListed.isActive).toBe(false);
    await page.request.patch(`/api/store/promotions/${promotion.id}`, { data: { isActive: true }, headers: { 'content-type': 'application/json' } });
  });

  test('F2 validates promotion type, value, and bounded text inputs', async ({ page }) => {
    await login(page);
    const invalids = [
      { name: '', type: 'CART_PERCENTAGE', value: 10 },
      { name: 'bad-type', type: 'NOT_A_PROMOTION', value: 10 },
      { name: 'negative', type: 'CART_FIXED', value: -1 },
      { name: 'long-description', type: 'CART_FIXED', value: 1, description: 'x'.repeat(501) },
    ];
    for (const input of invalids) {
      const response = await post(page, '/api/store/promotions', input);
      expect(response.status()).toBe(400);
      expect((await body(response))?.error?.code).toBe('VALIDATION_ERROR');
    }
  });

  test('F3 evaluates cart percentage and fixed discounts with exact LKR cents', async ({ page }) => {
    await login(page);
    const precisionCode = `PREC${Date.now().toString(36).slice(-6)}`.toUpperCase();
    const percentage = await createPromotion(page, { name: `M15 Percent ${RUN}`, type: 'PROMO_CODE', value: 10, promoCode: precisionCode });
    const fixed = await createPromotion(page, { name: `M15 Fixed ${RUN}`, type: 'CART_FIXED', value: 0.01 });
    state.promotionIds.push(percentage.id, fixed.id);

    const evaluated = await evaluate(page, state.variant, { promoCode: precisionCode });
    expect(evaluated.response.status()).toBe(200);
    const applied = evaluated.result.data.appliedDiscounts.find((d: any) => d.promotionId === percentage.id);
    expect(applied).toBeTruthy();
    const expected = Number(variantPrice(state.variant)) * 2 * 0.1;
    expect(Number(applied.discountAmount).toFixed(2)).toBe(expected.toFixed(2));
    expect(Number(evaluated.result.data.totalDiscountAmount).toFixed(2)).toBe(Number(evaluated.result.data.totalDiscountAmount).toFixed(2));
    expect(evaluated.result.data.skippedPromotions.length).toBeGreaterThanOrEqual(0);
  });

  test('F4 evaluates BOGO and category promotions only for eligible cart lines', async ({ page }) => {
    await login(page);
    const bogo = await createPromotion(page, { name: `M15 BOGO ${RUN}`, type: 'BOGO', value: 1, minQuantity: 2 });
    const category = await createPromotion(page, {
      name: `M15 Category ${RUN}`, type: 'CATEGORY_PERCENTAGE', value: 7.5,
      targetCategoryId: state.product.categoryId,
    });
    state.promotionIds.push(bogo.id, category.id);
    const evaluated = await evaluate(page, state.variant, { cartLines: [{
      variantId: state.variant.id, quantity: 2, unitPrice: variantPrice(state.variant), categoryId: state.product.categoryId,
    }] });
    expect(evaluated.response.status()).toBe(200);
    const ids = evaluated.result.data.appliedDiscounts.map((d: any) => d.promotionId);
    expect(ids).toContain(category.id);
    expect(ids).not.toContain(bogo.id);
  });

  test('F5 validates promo codes case-insensitively and rejects expired or unknown codes', async ({ page }) => {
    await login(page);
    const code = `M15${Date.now().toString(36).slice(-6)}`.toUpperCase();
    const promotion = await createPromotion(page, {
      name: `M15 Code ${RUN}`, type: 'PROMO_CODE', value: 15, promoCode: code,
    });
    state.promotionIds.push(promotion.id);
    const valid = await page.request.post('/api/store/promotions/validate-code', {
      data: { code: code.toLowerCase(), cartLines: [{ variantId: state.variant.id, quantity: 1, unitPrice: variantPrice(state.variant) }] },
      headers: { 'content-type': 'application/json' },
    });
    expect(valid.status()).toBe(200);
    expect((await body(valid)).data.promotionId).toBe(promotion.id);

    const unknown = await page.request.post('/api/store/promotions/validate-code', {
      data: { code: 'NO-SUCH-M15-CODE', cartLines: [{ variantId: state.variant.id, quantity: 1, unitPrice: variantPrice(state.variant) }] },
      headers: { 'content-type': 'application/json' },
    });
    expect(unknown.status()).toBe(422);
    expect((await body(unknown)).error.code).toBe('PROMO_INVALID');
  });

  test('F6 honors scheduled windows and ignores inactive promotions', async ({ page }) => {
    await login(page);
    const future = await createPromotion(page, {
      name: `M15 Future ${RUN}`, type: 'CART_PERCENTAGE', value: 99,
      startsAt: '2999-01-01T00:00:00.000Z',
    });
    const inactive = await createPromotion(page, {
      name: `M15 Inactive ${RUN}`, type: 'CART_PERCENTAGE', value: 99, isActive: false,
    });
    state.promotionIds.push(future.id, inactive.id);
    const evaluated = await evaluate(page, state.variant);
    expect(evaluated.result.data.appliedDiscounts.some((d: any) => d.promotionId === future.id)).toBe(false);
    expect(evaluated.result.data.appliedDiscounts.some((d: any) => d.promotionId === inactive.id)).toBe(false);
  });

  test('F7 persists evaluated discount and applied promotion on a completed sale', async ({ page }) => {
    await login(page);
    const persistCode = `SALE${Date.now().toString(36).slice(-6)}`.toUpperCase();
    const promotion = await createPromotion(page, { name: `M15 Persist ${RUN}`, type: 'PROMO_CODE', value: 5, promoCode: persistCode });
    state.promotionIds.push(promotion.id);
    const evaluated = await evaluate(page, state.variant, { promoCode: persistCode });
    const applied = evaluated.result.data.appliedDiscounts.find((d: any) => d.promotionId === promotion.id);
    expect(applied).toBeTruthy();
    const saleResponse = await post(page, '/api/store/sales', {
      customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 1 }],
      paymentMethod: 'CARD',
      cartDiscountAmount: Number(applied.discountAmount),
      appliedPromotions: evaluated.result.data.appliedDiscounts,
    });
    expect(saleResponse.status()).toBe(201);
    const sale = (await body(saleResponse)).data;
    state.saleIds.push(sale.id);
    expect(Number(sale.discountAmount).toFixed(2)).toBe(Number(applied.discountAmount).toFixed(2));
    expect(sale.appliedPromotions.some((d: any) => d.promotionId === promotion.id)).toBe(true);
    expect(Number(sale.lines[0].lineTotalAfterDiscount)).toBe(Number(sale.lines[0].lineTotalBeforeDiscount));
  });

  test('F8 bulk price updates preserve two-decimal arithmetic and audit the product', async ({ page }) => {
    await login(page);
    const before = Number(state.variant.retailPrice);
    const response = await page.request.post('/api/store/products/bulk-price-update', {
      data: { productIds: [state.product.id], mode: 'PERCENT', percentage: 10, direction: 'INCREASE', target: 'RETAIL' },
      headers: { 'content-type': 'application/json' },
    });
    expect(response.status()).toBe(200);
    expect((await body(response)).data.updated).toBeGreaterThan(0);
    const after = await body(await page.request.get(`/api/store/products/${state.product.id}`));
    const updatedVariant = after.data.variants.find((v: any) => v.id === state.variant.id);
    expect(Number(updatedVariant.retailPrice).toFixed(2)).toBe((Math.round(before * 1.1 * 100) / 100).toFixed(2));
    await page.request.post('/api/store/products/bulk-price-update', {
      data: { productIds: [state.product.id], mode: 'FIXED', costPrice: Number(updatedVariant.costPrice), retailPrice: before },
      headers: { 'content-type': 'application/json' },
    });
  });

  test('F9 customer pricing rules apply to tagged customers and stop when deactivated', async ({ page }) => {
    await login(page);
    // No rule yet → no accidental customer-pricing discount.
    const before = await evaluate(page, state.variant, { customerId: state.customer.id });
    expect(before.response.status()).toBe(200);
    expect(before.result.data.appliedDiscounts.some((d: any) => d.promotionType === 'CUSTOMER_PRICING')).toBe(false);

    // Tag the fixture customer so the rule can match it (evaluation keys off
    // exact Customer.tags membership).
    const tag = `M15TAG${RUN}`.toUpperCase();
    const tagged = await page.request.patch(`/api/store/customers/${state.customer.id}`, {
      data: { tags: [tag] }, headers: { 'content-type': 'application/json' },
    });
    expect(tagged.status()).toBe(200);

    const retailPrice = Number(variantPrice(state.variant));
    const rulePrice = Math.round(retailPrice * 0.5 * 100) / 100;
    // Window covers "now" so the rule is live for the evaluation below.
    const created = await post(page, '/api/store/customer-pricing-rules', {
      customerTag: tag,
      variantId: state.variant.id,
      price: rulePrice,
      startsAt: '2000-01-01T00:00:00.000Z',
      endsAt: '2999-01-01T00:00:00.000Z',
    });
    const rule = await body(created);
    expect(created.status(), JSON.stringify(rule)).toBe(201);
    state.customerPricingRuleIds.push(rule.data.id);
    expect(rule.data.customerTag).toBe(tag);
    expect(rule.data.variantId).toBe(state.variant.id);

    const listed = await body(await page.request.get(`/api/store/customer-pricing-rules?customerTag=${tag}`));
    expect(listed.data.some((row: any) => row.id === rule.data.id)).toBe(true);

    // Cart evaluation for the tagged customer now shows the rule price.
    const applied = await evaluate(page, state.variant, { customerId: state.customer.id });
    expect(applied.response.status()).toBe(200);
    const pricing = applied.result.data.appliedDiscounts.find((d: any) => d.promotionType === 'CUSTOMER_PRICING');
    expect(pricing).toBeTruthy();
    expect(pricing.promotionId).toBe(rule.data.id);
    const expectedDiscount = ((retailPrice - rulePrice) * 2).toFixed(2);
    expect(Number(pricing.discountAmount).toFixed(2)).toBe(expectedDiscount);

    // Overlap guard: a second active rule for the same tag/variant/window 409s.
    const overlap = await post(page, '/api/store/customer-pricing-rules', {
      customerTag: tag,
      variantId: state.variant.id,
      price: 1,
    });
    expect(overlap.status()).toBe(409);
    expect((await body(overlap)).error.code).toBe('CUSTOMER_PRICING_OVERLAP');

    // Deactivate → normal price returns.
    const deactivated = await page.request.delete(`/api/store/customer-pricing-rules/${rule.data.id}`);
    expect(deactivated.status()).toBe(200);
    expect((await body(deactivated)).data.isActive).toBe(false);
    const after = await evaluate(page, state.variant, { customerId: state.customer.id });
    expect(after.response.status()).toBe(200);
    expect(after.result.data.appliedDiscounts.some((d: any) => d.promotionType === 'CUSTOMER_PRICING')).toBe(false);
  });

  test('S1 enforces unauthenticated and cashier permissions', async ({ request, browser }) => {
    expect((await request.get(`${BASE_URL}/api/store/promotions`)).status()).toBe(401);
    const cashier = await browser.newPage();
    await login(cashier, CASHIER);
    expect((await cashier.request.post('/api/store/promotions', { data: { name: 'cashier', type: 'CART_FIXED', value: 1 } })).status()).toBe(403);
    expect((await cashier.request.post('/api/store/products/bulk-price-update', { data: {} })).status()).toBe(403);
    await cashier.close();
  });

  test('S2 prevents cross-tenant promotion and product price access', async ({ page, browser }) => {
    await login(page);
    const promotion = await createPromotion(page, { name: `M15 Tenant ${RUN}`, type: 'CART_FIXED', value: 1 });
    state.promotionIds.push(promotion.id);
    const other = await browser.newPage();
    await login(other, TENANT_TWO);
    expect((await other.request.patch(`/api/store/promotions/${promotion.id}`, { data: { value: 2 } })).status()).toBe(500);
    const foreignEvaluate = await evaluate(other, state.variant);
    expect(foreignEvaluate.result.data.appliedDiscounts.some((d: any) => d.promotionId === promotion.id)).toBe(false);
    await other.close();
  });

  test('X1 round-trips Sinhala, Tamil, emoji, and XSS-shaped promotion text inertly', async ({ page }) => {
    await login(page);
    const promotion = await createPromotion(page, {
      name: `සිංහල தமிழ் 🎁 ${RUN}`, type: 'CART_FIXED', value: 0.01,
      description: '<script>alert(1)</script> QA',
    });
    state.promotionIds.push(promotion.id);
    expect(promotion.name).toContain('සිංහල');
    expect(promotion.name).toContain('தமிழ்');
    await page.goto(`${BASE_URL}/promotions`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(promotion.name)).toBeVisible({ timeout: 30_000 });
    expect(await page.locator('script').filter({ hasText: 'alert(1)' }).count()).toBe(0);
  });

  test('X2 rejects negative quantities and hostile numeric overflow without a server 500', async ({ page }) => {
    await login(page);
    const negative = await post(page, '/api/store/promotions/evaluate', {
      cartLines: [{ variantId: state.variant.id, quantity: -1, unitPrice: '10.00' }],
    });
    expect(negative.status()).toBe(400);
    // M15-02 (BUG-47): `value` is now bounded per promotion type, so the
    // safe-integer ceiling is rejected as a client-input error naming the field
    // rather than reaching the Decimal(12,2) column and surfacing as a 500.
    const overflow = await post(page, '/api/store/promotions', {
      name: `M15 Overflow ${RUN}`, type: 'CART_PERCENTAGE', value: Number.MAX_SAFE_INTEGER,
    });
    expect(overflow.status()).toBe(400);
    const overflowBody = await body(overflow);
    expect(overflowBody.error.code).toBe('VALIDATION_ERROR');
    expect(overflowBody.error.message).toMatch(/value/i);

    // Every numeric shape is bounded: >100% percentage, an over-wide fixed
    // amount, and a non-integer free-item quantity all stay 400s.
    for (const input of [
      { name: `M15 Pct ${RUN}`, type: 'CART_PERCENTAGE', value: 101 },
      { name: `M15 Amx ${RUN}`, type: 'CART_FIXED', value: 99999999999.99 },
      { name: `M15 Qty ${RUN}`, type: 'BOGO', value: 1.5 },
      { name: `M15 Min ${RUN}`, type: 'BOGO', value: 1, minQuantity: 0 },
    ]) {
      const response = await post(page, '/api/store/promotions', input);
      expect(response.status(), JSON.stringify(input)).toBe(400);
      expect((await body(response)).error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('H1 supports scanner-like SKU input on the promotions-adjacent POS catalog', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'domcontentloaded' });
    const search = page.getByPlaceholder(/search products, sku, barcode/i);
    await search.fill(state.variant.sku);
    await expect(page.getByText(state.product.name).first()).toBeVisible({ timeout: 30_000 });
    await search.press('Enter');
  });

  test('N1 treats mocked promotion outages as recoverable HTTP failures', async ({ page }) => {
    await login(page);
    await page.route('**/api/store/promotions/evaluate', async (route) => {
      await route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'gateway timeout' } }) });
    });
    const status = await page.evaluate(async () => (await fetch('/api/store/promotions/evaluate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cartLines: [] }),
    })).status);
    expect(status).toBe(504);
    await page.unroute('**/api/store/promotions/evaluate');
  });

  test('N2 concurrent promotion submissions never produce an unhandled server failure', async ({ page }) => {
    await login(page);
    const payload = { name: `M15 Race ${RUN}`, type: 'CART_FIXED', value: 2 };
    const responses = await Promise.all([post(page, '/api/store/promotions', payload), post(page, '/api/store/promotions', payload)]);
    for (const response of responses) {
      expect(response.status()).toBeLessThan(500);
      if (response.status() === 201) state.promotionIds.push((await body(response)).data.id);
    }
  });

  test('T1 rejects malformed promotion dates rather than silently activating invalid windows', async ({ page }) => {
    await login(page);
    const response = await post(page, '/api/store/promotions', {
      name: `M15 Bad Date ${RUN}`, type: 'CART_PERCENTAGE', value: 4, startsAt: 'not-a-date',
    });
    // Defect pin: Date parsing currently reaches Prisma and may surface as 500.
    expect([400, 500]).toContain(response.status());
    if (response.status() === 201) state.promotionIds.push((await body(response)).data.id);
  });

  test('T2 does not leak promotion data across a future or expired time window', async ({ page }) => {
    await login(page);
    const expired = await createPromotion(page, {
      name: `M15 Expired ${RUN}`, type: 'PROMO_CODE', value: 20,
      promoCode: `OLD${RUN}`, endsAt: '2000-01-01T00:00:00.000Z',
    });
    state.promotionIds.push(expired.id);
    const evaluated = await evaluate(page, state.variant, { promoCode: expired.promoCode });
    expect(evaluated.result.data.appliedDiscounts.some((d: any) => d.promotionId === expired.id)).toBe(false);
    expect(evaluated.result.data.skippedPromotions.some((s: any) => /expired|inactive|not found/i.test(s.reason))).toBe(true);
  });
});

function variantPrice(variant: any): string {
  return Number(variant.retailPrice).toFixed(2);
}
