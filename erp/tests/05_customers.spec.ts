import { test, expect, type Page } from '@playwright/test';

/**
 * 05_customers.spec.ts — MODULE 5: Customers CRM
 *
 * Roadmap scope (QA_ROADMAP.md Module 05):
 *   • UI:  /customers, /customers/[customerId], /customers/import,
 *          /customers/broadcast (+ /history)
 *   • API: /api/store/customers (+ [id], import, contact-export, broadcast),
 *          /api/customers/count, /api/customers/preview, /api/broadcast/history
 *   • Prisma: Customer (phone-per-tenant, tags[], creditBalance, totalSpend,
 *             lastPurchaseAt, soft delete via deletedAt), StoreCredit,
 *             CustomerBroadcast
 *
 * Contracts verified by source inspection + API probes (READ-ONLY):
 *   • CreateCustomerSchema: name 1..100, phone 1..20, email valid optional,
 *     gender MALE|FEMALE|OTHER, birthday string, tags string[], notes ≤500.
 *   • Duplicate phone (per tenant, live rows only) → 409 CONFLICT.
 *   • DELETE is a SOFT delete (deletedAt + isActive=false); second DELETE → 404;
 *     PATCH after delete → 404; recreate same phone after soft delete → 201
 *     (phone has NO DB unique constraint — pre-check queries live rows only).
 *   • Import: multipart 'csv', 400 no file, 413 >2MB, 415 non-CSV, 422 >500
 *     rows; per-row validation errors; duplicate phones skipped.
 *   • contact-export: CSV attachment (customer:view permission — CASHIER has it).
 *   • broadcast: message 1..1000, filters {tag, spendMin, birthdayMonth 1..12},
 *     >200 recipients → 422; returns 202 {broadcastId, recipientCount}.
 *   • /api/broadcast/history: 403 for CASHIER/STOCK_CLERK.
 *   • Loyalty tiers: FIRST_TIME <2 orders, REPEAT ≥2, LOYAL ≥5 (orderCount).
 *   • Page guards: (store) layout redirects to /login without a session;
 *     /customers itself has NO permission gate (CASHIER may view + create).
 *
 * 10-point spectrum mapping is annotated per describe block.
 * All created data is RUN-suffixed and soft-deleted in cleanup (Appendix C.7).
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

const RUN = `m05x${Date.now().toString(36)}`.slice(-12);

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

const apiPatch = (p: Page, url: string, data: any) =>
  p.request.patch(url, { data, headers: { 'content-type': 'application/json' } });

/**
 * Login helper. OWNER lands on /dashboard; CASHIER may open an "Open POS"
 * tab-choice dialog — race URL-vs-dialog like the Module 02/04 specs.
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

/** Create a customer via API and return { id, status, body }. */
async function createCustomer(page: Page, data: Record<string, unknown>) {
  const res = await apiPost(page, '/api/store/customers', data);
  return { status: res.status(), body: await json(res) };
}

/** Soft-delete a customer by id, tolerating 404 (already gone). */
async function deleteCustomer(page: Page, id: string) {
  const res = await page.request.delete(`/api/store/customers/${id}`);
  return res.status();
}

/** Find live customers by phone search and return their ids. */
async function findCustomerIdsByPhone(page: Page, phone: string): Promise<string[]> {
  const res = await page.request.get(
    `/api/store/customers?search=${encodeURIComponent(phone)}&limit=100`,
  );
  const body = await json(res);
  const rows: any[] = body?.data?.customers ?? [];
  return rows.map((c) => c.id as string);
}

// ============================================================================
// §1 FUNCTIONAL & BUSINESS LOGIC — happy paths, validation, constraints
// ============================================================================

test.describe.serial('Module 5 — Customers CRM (full-scope QA)', () => {
  test.describe.configure({ timeout: 180_000 });

  const state: { createdIds: string[]; tenant2Ids: string[] } = { createdIds: [], tenant2Ids: [] };

  // ── §1 Functional & business logic ─────────────────────────────────────────

  test('F1 customers page renders + Add Customer sheet creates via UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 90_000 });
    // Gate on the shell's search input carrying React props BEFORE clicking —
    // a pre-hydration click on "Add Customer" is silently swallowed.
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');
    await expect(page.getByRole('button', { name: 'Add Customer' })).toBeVisible();

    const name = `${RUN} UI Customer`;
    const phone = `07${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    await page.getByRole('button', { name: 'Add Customer' }).click();
    // Radix Sheet portals the title out of the main tree; match by text.
    await expect(page.getByText('New Customer', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(name);
    await page.locator('#phone').fill(phone);
    // NOTE: email is filled because leaving it empty currently blocks submission
    // with "Invalid email address" (BUG-25 — dedicated pin at the end).
    await page.locator('#email').fill(`${RUN}.ui@example.com`);
    // NOTE: birthday is set because the sheet always submits `birthday: ''`
    // when untouched, which the API turns into `new Date('Invalid Date')` →
    // 409 with raw Prisma internals (BUG-26 — dedicated pin at the end).
    await page.locator('#birthday').fill('1995-06-15');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText('Customer created')).toBeVisible({ timeout: 30_000 });

    // Resolve the id via API first (deterministic), then force a hard reload —
    // the client list can keep serving the pre-create page from the react-query
    // cache even after invalidateQueries fires (observed during QA).
    const ids = await findCustomerIdsByPhone(page, phone);
    expect(ids.length, 'created customer resolvable via API').toBe(1);
    if (ids[0]) state.createdIds.push(ids[0]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator('a', { hasText: name }).first(),
    ).toBeVisible({ timeout: 45_000 });
  });

  test('F2 API create 201 + full round-trip (email/gender/birthday/tags/notes)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `071${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const payload = {
      name: `${RUN} Round Trip`,
      phone,
      email: `${RUN}.rt@example.com`,
      gender: 'FEMALE',
      birthday: '1995-06-15',
      tags: ['VIP', 'ONLINE'],
      notes: 'Prefers herbal teas. QA round-trip record.',
    };
    const { status, body } = await createCustomer(page, payload);
    expect(status, 'POST /api/store/customers → 201').toBe(201);
    expect(body?.data?.name).toBe(payload.name);
    expect(body?.data?.phone).toBe(phone);
    expect(body?.data?.email).toBe(payload.email);
    expect(body?.data?.gender).toBe('FEMALE');
    expect(String(body?.data?.birthday ?? '').startsWith('1995-06-15')).toBeTruthy();
    expect(body?.data?.tags).toEqual(['VIP', 'ONLINE']);
    expect(body?.data?.notes).toBe(payload.notes);
    expect(body?.data?.totalSpend).toBeDefined();
    expect(Number(body?.data?.totalSpend)).toBe(0);
    if (body?.data?.id) state.createdIds.push(body.data.id);

    // GET reflects the same record.
    const get = await page.request.get(`/api/store/customers/${body.data.id}`);
    expect(get.status()).toBe(200);
    const got = await json(get);
    expect(got?.data?.phone).toBe(phone);
    expect(got?.data?.orderCount).toBe(0);
  });

  test('F3 duplicate phone refused: POST → 409, PATCH to existing phone → 409', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phoneA = `072${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const phoneB = `073${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const a = await createCustomer(page, { name: `${RUN} DupA`, phone: phoneA });
    const b = await createCustomer(page, { name: `${RUN} DupB`, phone: phoneB });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    if (a.body?.data?.id) state.createdIds.push(a.body.data.id);
    if (b.body?.data?.id) state.createdIds.push(b.body.data.id);

    const dupPost = await createCustomer(page, { name: `${RUN} DupC`, phone: phoneA });
    expect(dupPost.status, 'duplicate phone on create → 409').toBe(409);
    expect(dupPost.body?.error?.code ?? '').toBe('CONFLICT');

    const dupPatch = await apiPatch(page, `/api/store/customers/${b.body?.data?.id ?? ''}`, {
      phone: phoneA,
    });
    const dupPatchBody = await json(dupPatch);
    expect(dupPatch.status(), 'PATCH to another customer’s phone → 409').toBe(409);
    expect(dupPatchBody?.error?.code ?? '').toBe('CONFLICT');
  });

  test('F4 detail page renders profile + stats; edit via sheet persists', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `074${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const created = await createCustomer(page, {
      name: `${RUN} Detail`,
      phone,
      tags: ['REGULAR'],
    });
    expect(created.status).toBe(201);
    const id = created.body?.data?.id as string;
    state.createdIds.push(id);

    await page.goto(`${BASE_URL}/customers/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: `${RUN} Detail` }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(phone).first()).toBeVisible();
    await expect(page.getByText('Total Spend')).toBeVisible();
    await expect(page.getByText('Avg Order Value')).toBeVisible();
    await expect(page.getByText('Visits')).toBeVisible();
    await expect(page.getByText('Credit Balance')).toBeVisible();

    // Edit via sheet.
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(page.getByText('Edit Customer', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(`${RUN} Detail Renamed`);
    // BUG-25 workaround: empty optional email blocks submission.
    // BUG-26 workaround: untouched birthday submits '' → API 409; set a value.
    await page.locator('#email').fill(`${RUN}.detail@example.com`);
    await page.locator('#birthday').fill('1990-01-01');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByText('Customer updated')).toBeVisible({ timeout: 30_000 });

    const get = await json(await page.request.get(`/api/store/customers/${id}`));
    expect(get?.data?.name).toBe(`${RUN} Detail Renamed`);
  });

  test('F5 validation contract: missing/oversized/invalid fields → 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const cases: Array<[string, Record<string, unknown>]> = [
      ['missing name', { phone: '0760000001' }],
      ['missing phone', { name: `${RUN} NoPhone` }],
      ['empty phone', { name: `${RUN} EmptyPhone`, phone: '' }],
      ['phone 21 chars', { name: `${RUN} P21`, phone: '0'.repeat(21) }],
      ['name 101 chars', { name: 'x'.repeat(101), phone: '0760000002' }],
      ['invalid email', { name: `${RUN} BadEmail`, phone: '0760000003', email: 'not-an-email' }],
      ['notes 501 chars', { name: `${RUN} Notes`, phone: '0760000004', notes: 'x'.repeat(501) }],
      ['invalid gender', { name: `${RUN} BadGender`, phone: '0760000005', gender: 'HELICOPTER' }],
      ['tags not array', { name: `${RUN} BadTags`, phone: '0760000006', tags: { a: 1 } }],
    ];

    for (const [label, payload] of cases) {
      const res = await apiPost(page, '/api/store/customers', payload);
      const body = await json(res);
      expect(res.status(), `${label} → 400`).toBe(400);
      expect(body?.error?.code ?? '', label).toBe('VALIDATION_ERROR');
    }
  });

  test('F6 CSV import: valid rows imported, dup phone skipped, bad row errored', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone1 = `081${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const csv = [
      'Name,Phone,Email,Gender,Birthday,Tags,Notes',
      `${RUN} Imp1,${phone1},imp1@example.com,MALE,1990-05-05,VIP,note1`,
      `${RUN} Imp2,${phone1},,FEMALE,,REGULAR,`, // duplicate phone → skipped
      `BadRow,,bad-email,XX,notadate,,`, // invalid row → error
    ].join('\n');

    const res = await page.request.post('/api/store/customers/import', {
      multipart: {
        csv: {
          name: 'customers.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv, 'utf8'),
        },
      },
    });
    expect(res.status(), 'import → 200').toBe(200);
    const body = await json(res);
    expect(body?.data?.imported).toBe(1);
    expect(body?.data?.skipped).toBe(1);
    expect(body?.data?.errors).toBe(1);
    expect(JSON.stringify(body?.data?.errorDetails ?? [])).toContain('Invalid email');

    const ids = await findCustomerIdsByPhone(page, phone1);
    expect(ids.length).toBe(1);
    for (const id of ids) state.createdIds.push(id);
  });

  test('F7 import guards: no file 400, non-CSV 415, >500 rows 422, empty CSV 200/0', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const noFile = await page.request.post('/api/store/customers/import', {
      multipart: {},
    });
    expect(noFile.status(), 'no file → 400').toBe(400);

    const txt = await page.request.post('/api/store/customers/import', {
      multipart: {
        csv: {
          name: 'customers.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('a,b\n1,2', 'utf8'),
        },
      },
    });
    expect(txt.status(), 'non-CSV extension → 415').toBe(415);

    const rows = ['Name,Phone'];
    for (let i = 0; i < 501; i++) rows.push(`R${i},099${String(i).padStart(8, '0')}`);
    const tooMany = await page.request.post('/api/store/customers/import', {
      multipart: {
        csv: {
          name: 'big.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(rows.join('\n'), 'utf8'),
        },
      },
    });
    expect(tooMany.status(), '501 rows → 422').toBe(422);
    expect((await json(tooMany))?.error?.code ?? '').toBe('TOO_MANY_ROWS');

    const empty = await page.request.post('/api/store/customers/import', {
      multipart: {
        csv: {
          name: 'empty.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('Name,Phone\n', 'utf8'),
        },
      },
    });
    expect(empty.status(), 'header-only CSV → 200').toBe(200);
    expect((await json(empty))?.data?.imported).toBe(0);
  });

  test('F8 one-click contact export: 200 CSV attachment with header row', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const res = await page.request.get('/api/store/customers/contact-export?scope=ALL');
    expect(res.status(), 'contact-export → 200').toBe(200);
    const disposition = res.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toMatch(/contacts-.*\.csv/);
    expect(res.headers()['content-type']).toContain('text/csv');

    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect((text.split(/\r?\n/)[0] ?? '').toLowerCase()).toContain('name');
  });

  test('F9 broadcast 202 with tag filter + history page/API record it', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const tag = `M05BC${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const mk = await createCustomer(page, {
      name: `${RUN} BcTarget`,
      phone: `085${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`,
      tags: [tag],
    });
    expect(mk.status).toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    const res = await apiPost(page, '/api/store/customers/broadcast', {
      message: `QA broadcast ${RUN} hello`,
      filters: { tag },
    });
    expect(res.status(), 'broadcast → 202').toBe(202);
    const body = await json(res);
    expect(body?.data?.broadcastId).toBeTruthy();
    expect(body?.data?.recipientCount).toBeGreaterThanOrEqual(0);

    // History API lists the broadcast for this tenant.
    const hist = await page.request.get('/api/broadcast/history');
    expect(hist.status()).toBe(200);
    const histBody = await json(hist);
    const rows: any[] = histBody?.data ?? [];
    expect(
      rows.some((r) => String(r.message ?? '').includes(RUN)),
      'broadcast visible in history API',
    ).toBeTruthy();

    // History page renders.
    await page.goto(`${BASE_URL}/customers/broadcast/history`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(`QA broadcast ${RUN} hello`).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test('F10 count + preview endpoints honor tag filter', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const tag = `M05CP${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const mk = await createCustomer(page, {
      name: `${RUN} CountTarget`,
      phone: `086${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`,
      tags: [tag],
    });
    expect(mk.status).toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    const count = await json(await page.request.get(`/api/customers/count?tags=${tag}`));
    expect(count?.success).toBe(true);
    expect(count?.data?.count).toBeGreaterThanOrEqual(1);

    const preview = await json(await page.request.get(`/api/customers/preview?tags=${tag}`));
    expect(preview?.success).toBe(true);
    const rows: any[] = preview?.data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r.tags ?? []).includes(tag))).toBeTruthy();
  });

  // ── §2 Financial & calculation precision ───────────────────────────────────

  test('P1 money fields are 2-dp decimal strings; list renders LKR format', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `087${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} Money`, phone });
    expect(mk.status).toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    // API: Decimal columns serialize as strings with ≤2 dp.
    const raw = mk.body?.data;
    expect(typeof raw?.totalSpend === 'string' || typeof raw?.totalSpend === 'number').toBeTruthy();
    expect(Number(raw?.totalSpend)).toBe(0);
    expect(Number(raw?.creditBalance)).toBe(0);

    const detail = await json(await page.request.get(`/api/store/customers/${raw.id}`));
    expect(detail?.data?.avgOrderValue).toBeDefined();
    expect(Number(detail?.data?.avgOrderValue)).toBe(0);

    // UI: list renders formatted currency (Rs. prefix from formatRupee).
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('table').first()).toBeVisible();
    const cell = page.locator('table tbody td.font-mono').first();
    await expect(cell).toBeVisible({ timeout: 30_000 });
    const cellText = (await cell.textContent()) ?? '';
    expect(cellText.trim().length).toBeGreaterThan(0);
  });

  test('P2 spend-band filter + pagination clamps behave deterministically', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Zero-spend band: every returned row must have totalSpend 0.
    const band = await json(
      await page.request.get('/api/store/customers?spendMin=0&spendMax=0&limit=50'),
    );
    expect(band?.success).toBe(true);
    for (const c of band?.data?.customers ?? []) {
      expect(Number(c.totalSpend)).toBe(0);
    }

    // Pagination: limit=2 → ≤2 rows + totalPages computed.
    const p1 = await json(await page.request.get('/api/store/customers?page=1&limit=2'));
    expect(p1?.data?.customers.length).toBeLessThanOrEqual(2);
    expect(p1?.data?.totalPages).toBeGreaterThanOrEqual(1);

    // page=0 clamps to page 1 (no 500).
    const p0 = await page.request.get('/api/store/customers?page=0&limit=2');
    expect(p0.status()).toBe(200);

    // limit=99999 clamps to ≤100 (service cap).
    const big = await json(await page.request.get('/api/store/customers?limit=99999'));
    expect(big?.data?.customers.length).toBeLessThanOrEqual(100);
  });

  // ── §3 Cross-module cascade & ledger impact ────────────────────────────────

  test('L1 new customer starts with clean ledger-derived fields', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `088${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} Ledger`, phone });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    const detail = await json(await page.request.get(`/api/store/customers/${id}`));
    expect(detail?.data?.orderCount).toBe(0);
    expect(detail?.data?.visitCount).toBe(0);
    expect(Number(detail?.data?.avgOrderValue)).toBe(0);
    expect(detail?.data?.preferredCategories).toEqual([]);
    expect(detail?.data?.lastPurchaseAt).toBeNull();
    expect(detail?.data?.sales).toEqual([]);
  });

  test('L2 repeatBuyers filter isolates customers with ≥2 orders', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const res = await page.request.get('/api/store/customers?repeatBuyers=true&limit=100');
    expect(res.status()).toBe(200);
    const body = await json(res);
    // Every returned customer must have orderCount ≥ 2 (seed data may have none).
    for (const c of body?.data?.customers ?? []) {
      expect(c.orderCount).toBeGreaterThanOrEqual(2);
    }

    // UI: Repeat Buyers tab is present and clickable without error.
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    const tab = page.getByRole('button', { name: /repeat buyers/i }).first();
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  });

  // ── §4 Audit trail, soft delete & immutability ─────────────────────────────

  test('A1 delete is SOFT: absent from list, GET 404, isActive false', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `089${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} SoftDel`, phone });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;

    const del = await page.request.delete(`/api/store/customers/${id}`);
    expect(del.status(), 'DELETE → 200').toBe(200);
    const delBody = await json(del);
    expect(delBody?.data?.deletedAt).toBeTruthy();
    expect(delBody?.data?.isActive).toBe(false);

    // Gone from the live list…
    const list = await json(
      await page.request.get(`/api/store/customers?search=${encodeURIComponent(phone)}`),
    );
    expect((list?.data?.customers ?? []).length).toBe(0);

    // …and GET by id → 404 (live-row filter).
    const get = await page.request.get(`/api/store/customers/${id}`);
    expect(get.status()).toBe(404);
  });

  test('A2 double delete → 200 then 404; PATCH after delete → 404', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `090${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} DblDel`, phone });
    const id = mk.body?.data?.id as string;

    expect(await page.request.delete(`/api/store/customers/${id}`).then((r) => r.status())).toBe(200);
    const second = await page.request.delete(`/api/store/customers/${id}`);
    expect(second.status(), 'second DELETE → 404').toBe(404);

    const patch = await apiPatch(page, `/api/store/customers/${id}`, { name: 'zombie' });
    expect(patch.status(), 'PATCH after delete → 404').toBe(404);
  });

  test('A3 recreate same phone after soft delete → 201 (no DB unique; pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `091${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} Recreate`, phone });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    expect(
      await page.request.delete(`/api/store/customers/${id}`).then((r) => r.status()),
    ).toBe(200);

    // The duplicate pre-check only queries live rows and phone has no DB unique
    // constraint, so recreation succeeds (differs from Category/Brand BUG-21
    // behavior). Pin the ACCEPTABLE outcome: 201, never 500.
    const re = await createCustomer(page, { name: `${RUN} Recreated`, phone });
    expect(re.status, 'recreate after soft delete → 201 (not 500)').toBe(201);
    if (re.body?.data?.id) state.createdIds.push(re.body.data.id);
  });

  // ── §5 Chaos, button spamming & race conditions ────────────────────────────

  test('R1 double-click Create submits exactly ONE customer', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');

    const name = `${RUN} DblClick`;
    const phone = `092${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await expect(page.getByText('New Customer', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(name);
    await page.locator('#phone').fill(phone);
    // BUG-25 workaround: email must be filled or the sheet blocks submission.
    await page.locator('#email').fill(`${RUN}.dbl@example.com`);
    // BUG-26 workaround: untouched birthday submits '' → API 409; set a value.
    await page.locator('#birthday').fill('1990-01-01');

    const createBtn = page.getByRole('button', { name: 'Create', exact: true });
    await createBtn.dblclick();

    await expect(page.getByText('Customer created').first()).toBeVisible({ timeout: 30_000 });
    const ids = await findCustomerIdsByPhone(page, phone);
    expect(ids.length, 'exactly one customer created').toBe(1);
    for (const id of ids) state.createdIds.push(id);
  });

  test('R2 3-way concurrent same-phone create: zero 500s (BUG-27 pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `093${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const results = await Promise.all(
      [1, 2, 3].map((i) =>
        createCustomer(page, { name: `${RUN} Race ${i}`, phone }),
      ),
    );
    const statuses = results.map((r) => r.status);
    // DEFECT PIN: the duplicate-phone guard is a check-then-insert with NO DB
    // unique constraint on (tenantId, phone), so fully concurrent creates can
    // ALL pass the pre-check and insert duplicates (observed 3×201). The
    // hard requirement is only that the API never 500s under race.
    expect(statuses.filter((s) => s >= 500).length, 'zero 500s under race').toBe(0);
    expect(
      statuses.filter((s) => s === 201).length,
      'BUG-27: duplicates accepted under race (≥1 winner)',
    ).toBeGreaterThanOrEqual(1);

    for (const r of results) {
      if (r.status === 201 && r.body?.data?.id) state.createdIds.push(r.body.data.id);
    }
  });

  // ── §6 Hardware & device simulation ────────────────────────────────────────

  test('H1 scanner-style rapid keystrokes into search filter the grid', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `094${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} Scan`, phone });
    expect(mk.status).toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search by name or phone...').first();
    await expect(search).toBeVisible();
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');

    // Simulate a barcode/keyboard-wedge scanner: characters in rapid bursts.
    await search.pressSequentially(phone, { delay: 15 });
    await expect(
      page.locator('a', { hasText: `${RUN} Scan` }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('H2 CSV file upload via file chooser imports end-to-end', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `095${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    await page.goto(`${BASE_URL}/customers/import`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Import Customers' }),
    ).toBeVisible({ timeout: 60_000 });

    const csv = `Name,Phone,Tags\n${RUN} Upload,${phone},ONLINE\n`;
    // The file input is display:none, so the browser fires no filechooser for
    // it. Wait for the panel to hydrate, then inject a File via the
    // DataTransfer API and dispatch a change event — the same shape a real
    // chooser produces.
    await waitForHydratedInput(page, '#main-content input[type="file"]');
    await page.locator('#main-content input[type="file"]').evaluate(
      (el, csvText: string) => {
        const input = el as HTMLInputElement;
        const file = new File([csvText], 'customers.csv', { type: 'text/csv' });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      csv,
    );

    await expect(
      page.getByRole('button', { name: /import customers/i }),
    ).toBeEnabled({ timeout: 15_000 });

    await page.getByRole('button', { name: /import customers/i }).click();
    await expect(page.getByText(/imported/i).first()).toBeVisible({ timeout: 30_000 });

    const ids = await findCustomerIdsByPhone(page, phone);
    expect(ids.length, 'imported customer exists').toBe(1);
    for (const id of ids) state.createdIds.push(id);
  });

  // ── §7 Network resilience & offline sync ───────────────────────────────────

  test('N1 list API 500 → page degrades gracefully (no white-screen)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.route('**/api/store/customers?**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }),
    );
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2_000);

    // The shell survives; no uncaught exceptions escape the ErrorBoundary.
    expect(pageErrors, 'no uncaught page errors').toEqual([]);
    await expect(page.getByRole('button', { name: 'Add Customer' })).toBeVisible();
  });

  test('N2 create API 504 → error toast, sheet stays interactive', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');

    await page.route('**/api/store/customers', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 504, contentType: 'application/json', body: '{"success":false}' });
      }
      return route.continue();
    });

    await page.getByRole('button', { name: 'Add Customer' }).click();
    await expect(page.getByText('New Customer', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(`${RUN} Timeout`);
    await page.locator('#phone').fill(`096${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`);
    // BUG-25/26 workarounds: empty email blocks submission; empty birthday
    // would 409 before the route-fulfilled 504 can surface.
    await page.locator('#email').fill(`${RUN}.timeout@example.com`);
    await page.locator('#birthday').fill('1990-01-01');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText(/something went wrong|network error|failed/i).first()).toBeVisible({
      timeout: 30_000,
    });
    // Sheet remains open and interactive.
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
  });

  // ── §8 Security, RBAC & tenant isolation ───────────────────────────────────

  test('S1 unauthenticated: APIs 401, pages redirect to /login', async ({ page }) => {
    const apiRes = await page.request.get('/api/store/customers');
    expect(apiRes.status(), 'unauth list → 401').toBe(401);

    const postRes = await page.request.post('/api/store/customers', {
      data: { name: 'x', phone: 'y' },
      headers: { 'content-type': 'application/json' },
    });
    expect(postRes.status(), 'unauth create → 401').toBe(401);

    const exportRes = await page.request.get('/api/store/customers/contact-export');
    expect(exportRes.status(), 'unauth export → 401').toBe(401);

    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test('S2 CASHIER: may view + create, may NOT edit/delete/history', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);

    // Page accessible (cashier has customer:view + customer:create).
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });

    // Create allowed.
    const phone = `097${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} Cashier`, phone });
    expect(mk.status, 'cashier create → 201').toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // Edit/delete forbidden (no customer:edit / customer:delete).
    const patch = await apiPatch(page, `/api/store/customers/${id}`, { name: 'nope' });
    expect(patch.status(), 'cashier PATCH → 403').toBe(403);
    const del = await page.request.delete(`/api/store/customers/${id}`);
    expect(del.status(), 'cashier DELETE → 403').toBe(403);

    // Broadcast history forbidden for CASHIER role.
    const hist = await page.request.get('/api/broadcast/history');
    expect(hist.status(), 'cashier broadcast history → 403').toBe(403);

    // Contact export allowed (customer:view).
    const exp = await page.request.get('/api/store/customers/contact-export?scope=ALL');
    expect(exp.status(), 'cashier export → 200 (has customer:view)').toBe(200);
  });

  test('S3 cross-tenant: foreign customer 404; phone uniqueness is per-tenant', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `098${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, { name: `${RUN} Isolated`, phone });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // Tenant 2 owner cannot see, edit, or delete tenant 1's customer.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    const get = await page.request.get(`/api/store/customers/${id}`);
    expect(get.status(), 'cross-tenant GET → 404').toBe(404);
    const patch = await apiPatch(page, `/api/store/customers/${id}`, { name: 'hacked' });
    expect(patch.status(), 'cross-tenant PATCH → 404').toBe(404);
    const del = await page.request.delete(`/api/store/customers/${id}`);
    expect(del.status(), 'cross-tenant DELETE → 404').toBe(404);

    // Same phone is allowed on the other tenant (uniqueness is per-tenant).
    const re = await createCustomer(page, { name: `${RUN} Tenant2`, phone });
    expect(re.status, 'same phone on tenant 2 → 201').toBe(201);
    if (re.body?.data?.id) state.tenant2Ids.push(re.body.data.id);
  });

  // ── §9 Boundary inputs & chaos data ────────────────────────────────────────

  test('X1 Sinhala / Tamil / emoji names round-trip intact', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `099${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const name = `සමඟ ${RUN} தமிழ் 🌿`;
    const mk = await createCustomer(page, { name, phone });
    expect(mk.status, 'unicode name → 201').toBe(201);
    expect(mk.body?.data?.name).toBe(name);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    // Rendered intact in the UI.
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search by name or phone...').first();
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');
    await search.fill(phone);
    await expect(page.locator('a', { hasText: 'தமிழ்' }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('X2 stored XSS is inert in the UI (React escaping)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = `066${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const xssName = `<img src=x onerror=window.__m05xss=1>`;
    const mk = await createCustomer(page, { name: xssName, phone });
    expect(mk.status, 'XSS payload stored (≤100 chars) → 201').toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search by name or phone...').first();
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');
    await search.fill(phone);
    await expect(page.locator('a', { hasText: '<img src=x' }).first()).toBeVisible({
      timeout: 30_000,
    });

    const fired = await page.evaluate(() => (window as any).__m05xss);
    expect(fired, 'onerror handler must never execute').toBeUndefined();
  });

  test('X3 boundary lengths: name 100 / phone 20 / notes 500 all accepted', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Phone must be 20 chars AND unique — pad a RUN-derived number with zeros.
    const phone20 = `${Date.now().toString(36)}${RUN}`.replace(/[^a-z0-9]/g, '').padEnd(20, '0').slice(0, 20);
    const mk = await createCustomer(page, {
      name: 'X'.repeat(100),
      phone: phone20,
      notes: 'N'.repeat(500),
    });
    expect(mk.status, 'all-at-maximum → 201').toBe(201);
    expect((mk.body?.data?.name as string).length).toBe(100);
    expect((mk.body?.data?.phone as string).length).toBe(20);
    expect((mk.body?.data?.notes as string).length).toBe(500);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);
  });

  test('X4 chaos payloads never 500; server-owned fields ignore forgery', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const chaos: Array<[string, Record<string, unknown>]> = [
      ['null name', { name: null, phone: '0650000001' }],
      ['number name', { name: 12345, phone: '0650000002' }],
      ['array phone', { name: `${RUN} ArrPhone`, phone: ['07', '1'] }],
      ['__proto__ + unknown keys', {
        name: `${RUN} Proto`,
        phone: `065${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`,
        __proto__: { admin: true },
        unknownKey: 'x',
        totalSpend: 999999,
        createdAt: '1999-01-01T00:00:00Z',
      }],
    ];

    for (const [label, payload] of chaos) {
      const res = await apiPost(page, '/api/store/customers', payload);
      expect(res.status(), `${label} must not 500`).toBeLessThan(500);
    }

    // Forgery pin: server-owned fields win.
    const phone = `065${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const forged = await createCustomer(page, {
      name: `${RUN} Forgery`,
      phone,
      totalSpend: 999999,
      createdAt: '1999-01-01T00:00:00Z',
    });
    expect(forged.status).toBe(201);
    expect(Number(forged.body?.data?.totalSpend)).toBe(0);
    expect(String(forged.body?.data?.createdAt).startsWith('1999')).toBeFalsy();
    if (forged.body?.data?.id) state.createdIds.push(forged.body.data.id);

    const protoPhone = String(chaos[3]?.[1]?.phone ?? '');
    const protoRow = protoPhone ? await findCustomerIdsByPhone(page, protoPhone) : [];
    for (const id of protoRow) state.createdIds.push(id);
  });

  test('X5 filter chaos: non-numeric spendMin/limit → 400 naming the param (BUG-28 fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // FIXED (XC-01): the route parses query params through parseQueryInt/
    // parseQueryNumber, so malformed values are a typed 400 naming the param
    // instead of NaN reaching Prisma (BUG-28).
    const spendMin = await page.request.get('/api/store/customers?spendMin=abc');
    expect(spendMin.status(), 'spendMin=abc → 400 (BUG-28 fixed)').toBe(400);
    expect(((await spendMin.json()).error ?? {}).message).toContain('spendMin');

    const limit = await page.request.get('/api/store/customers?limit=abc');
    expect(limit.status(), 'limit=abc → 400 (BUG-28 fixed)').toBe(400);
  });

  // ── §10 Time-travel & retroactive dates ────────────────────────────────────

  test('T1 birthday: future date accepted; invalid date → 500 (BUG-29 pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Future birthday is accepted (no past-date validation) — pin as-is.
    const phone = `064${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const future = await createCustomer(page, {
      name: `${RUN} FutureBday`,
      phone,
      birthday: '2999-01-01',
    });
    expect(future.status, 'future birthday → 201').toBe(201);
    if (future.body?.data?.id) state.createdIds.push(future.body.data.id);

    // FIXED (INF-02): an unparseable birthday makes Prisma throw; the shared
    // mapper now returns a typed 400 with a friendly message — no raw dump,
    // no misleading 409 (BUG-29, BUG-21 class).
    const bad = await createCustomer(page, {
      name: `${RUN} BadBday`,
      phone: `064${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`,
      birthday: 'not-a-date',
    });
    expect(bad.status, 'invalid birthday → 400 (BUG-29 fixed)').toBe(400);
    const msg = String(bad.body?.error?.message ?? '');
    expect(msg, 'no Prisma internals leak').not.toMatch(/prisma|\.next|chunk|Invalid value for argument/i);
  });

  test('T2 birthdayMonth filter: count honors months; preview ignores invalid month', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Create a customer with a May birthday.
    const phone = `063${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const mk = await createCustomer(page, {
      name: `${RUN} MayBday`,
      phone,
      birthday: '1992-05-20',
    });
    expect(mk.status).toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    const countMay = await json(await page.request.get('/api/customers/count?birthdayMonth=5'));
    expect(countMay?.success).toBe(true);
    expect(countMay?.data?.count).toBeGreaterThanOrEqual(1);

    // Broadcast filter validates the month range…
    const badBroadcast = await apiPost(page, '/api/store/customers/broadcast', {
      message: 'x',
      filters: { birthdayMonth: 13 },
    });
    expect(badBroadcast.status(), 'broadcast birthdayMonth=13 → 400').toBe(400);

    // …but preview silently ignores an out-of-range month and returns ALL rows
    // (inconsistent with broadcast validation — documented as an observation).
    const preview = await page.request.get('/api/customers/preview?birthdayMonth=13');
    expect(preview.status(), 'preview must not 500 on month=13').toBe(200);
  });

  test('B1 BUG-25 pin: empty optional email blocks UI create with "Invalid email address"', async ({ page }) => {
    // DEFECT PIN: the API schema correctly marks email optional, but the UI
    // sheet's resolver rejects submission when the field is left empty,
    // showing "Invalid email address" under the optional Email input.
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search by name or phone..."]');

    await page.getByRole('button', { name: 'Add Customer' }).click();
    await expect(page.getByText('New Customer', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(`${RUN} NoEmail`);
    await page.locator('#phone').fill(`060${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`);
    // Email deliberately left empty.
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Documented defect: sheet stays open with the validation message; no
    // customer is created. When fixed, flip to assert creation succeeds.
    await expect(page.getByText('Invalid email address')).toBeVisible({ timeout: 15_000 });
    const phoneProbe = page.locator('#phone');
    const entered = await phoneProbe.inputValue();
    const ids = await findCustomerIdsByPhone(page, entered);
    expect(ids.length, 'customer must NOT be created while bug present').toBe(0);
  });

  test('B2 BUG-26 pin: untouched birthday submits "" → 400, no raw Prisma leak (INF-02)', async ({ page }) => {
    // INF-02 (W0) migrated this route's catch to mapPrismaError: an empty
    // birthday makes `new Date('')` → Invalid Date → Prisma validation error,
    // which now returns a typed 400 with a friendly message instead of the
    // old misleading 409 that echoed the raw Prisma dump (which contained the
    // text "already exists" in the source line). The remaining defect — an
    // untouched "" should be treated as "no birthday" (201) — is M05-02 (W3).
    await login(page, OWNER.email, OWNER.password);

    const phone = `061${Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10)}`;
    const res = await apiPost(page, '/api/store/customers', {
      name: `${RUN} BdayEmpty`,
      phone,
      email: `${RUN}.be@example.com`,
      birthday: '',
      tags: [],
      notes: '',
    });
    const body = await json(res);
    // FIXED (INF-02): no longer 500, no longer a leaky 409 — a clean 4xx.
    expect(res.status(), 'birthday:"" → 400 (no leak, no misleading 409)').toBe(400);
    const msg = String(body?.error?.message ?? '');
    expect(msg, 'no Prisma internals leak').not.toMatch(/prisma|Invalid value for argument|\.next|chunk/i);
  });

  // ── Cleanup (Appendix C.7 pattern) ─────────────────────────────────────────

  test('cleanup: soft-delete every customer created by this run', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    let deleted = 0;
    for (const id of state.createdIds) {
      const status = await deleteCustomer(page, id);
      if (status === 200) deleted++;
    }
    // Tenant-2 records need the tenant-2 session.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    for (const id of state.tenant2Ids) {
      const status = await deleteCustomer(page, id);
      if (status === 200) deleted++;
    }
    // Sweep: any RUN-suffixed stragglers (e.g. chaos rows without captured ids).
    await login(page, OWNER.email, OWNER.password);
    const sweep = await json(
      await page.request.get(`/api/store/customers?search=${encodeURIComponent(RUN)}&limit=100`),
    );
    for (const c of sweep?.data?.customers ?? []) {
      const status = await deleteCustomer(page, c.id);
      if (status === 200) deleted++;
    }
    expect(deleted, 'cleanup removed this run’s records').toBeGreaterThan(0);
  });
});
