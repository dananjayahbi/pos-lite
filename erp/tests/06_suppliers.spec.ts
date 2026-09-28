import { test, expect, type Page } from '@playwright/test';

/**
 * 06_suppliers.spec.ts — MODULE 6: Suppliers Master
 *
 * Roadmap scope (QA_ROADMAP.md Module 06):
 *   • UI:  /suppliers (list + SupplierSheet create/edit + archive dialog)
 *   • API: /api/store/suppliers (GET list, POST create),
 *          /api/store/suppliers/[id] (GET, PATCH),
 *          /api/store/suppliers/[id]/archive (PATCH)
 *   • Prisma: Supplier (tenant-scoped, isActive flag, leadTimeDays default 7,
 *             whatsappNumber nullable, @@unique([tenantId, phone]) post-M06-01,
 *             NO delete API — archive/unarchive are the only removal/return paths)
 *
 * Contracts verified by source inspection + API probes (READ-ONLY):
 *   • CreateSupplierSchema: name 1..100, contactName ≤100, phone regex
 *     ^(\+94\d{9}|07\d{8})$, whatsappNumber optional-or-empty (same regex),
 *     email valid-or-empty ≤100, address ≤500, leadTimeDays int 1..365
 *     (DB default 7), notes ≤1000. UpdateSupplierSchema = partial.
 *   • whatsappNumber defaults to phone on create; PATCH whatsappNumber:''
 *     resets it to phone (or null when phone absent).
 *   • FIXED (M06-01/BUG-30/31, D5): duplicate phone → 409 CONFLICT (DB
 *     @@unique + friendly pre-check, archived rows reserve the phone); name
 *     is NOT unique — duplicate name → 201 with a duplicateName warning flag.
 *   • NO DELETE endpoint (405) — archive (isActive=false) is the only removal
 *     path; archive is idempotent (double → 200); POST /suppliers/[id]/unarchive
 *     restores (M06-05); archived rows remain GET-able but PATCH → 409
 *     "restore first" (OBS-11 policy).
 *   • GET list: search matches name/contactName/phone (M06-05), page/limit
 *     clamped (page≥1, 1≤limit≤100) and NON-NUMERIC page/limit → 400 naming
 *     the param (XC-01, BUG-32 fixed); includeArchived=true reveals archived rows.
 *   • RBAC: supplier:view/create/edit — CASHIER has NONE (all APIs 403);
 *     /suppliers page itself has no page-level permission gate (layout
 *     auth-only), so CASHIER can open the page but every action 403s.
 *   • UI: SupplierSheet (Radix Sheet — title IS a real <h2> heading here),
 *     react-hook-form + standardSchemaResolver. FIXED (M06-03/BUG-33):
 *     clearing the defaulted leadTimeDays input coerces to undefined and
 *     submits cleanly (API default 7). FIXED (M06-04/BUG-34): the edit sheet
 *     resets to the selected supplier on OPEN — the first open is prefilled.
 *
 * 10-point spectrum mapping is annotated per describe block.
 * All created data is RUN-suffixed; cleanup archives + renames every row
 * this run created (no delete API exists — Appendix C.7 adapted).
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

const RUN = `m06x${Date.now().toString(36)}`.slice(-12);

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
 * tab-choice dialog — race URL-vs-dialog like the Module 02/04/05 specs.
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

/**
 * Collision-proof SL phone: `07` + base36 timestamp tail + 2 random digits.
 * The API regex only accepts +94XXXXXXXXX / 07XXXXXXXX, so the payload is
 * numeric-only; the RUN marker lives in the NAME for search/cleanup.
 */
let phoneSeq = 0;
const nextPhone = () => {
  phoneSeq += 1;
  return `07${Date.now().toString().slice(-7)}${(phoneSeq % 10).toString()}`;
};

/** Create a supplier via API and return { status, body }. */
async function createSupplier(page: Page, data: Record<string, unknown>) {
  const res = await apiPost(page, '/api/store/suppliers', data);
  return { status: res.status(), body: await json(res) };
}

/** Archive a supplier by id, tolerating 404 (already gone). */
async function archiveSupplier(page: Page, id: string) {
  const res = await page.request.patch(`/api/store/suppliers/${id}/archive`);
  return res.status();
}

/** Find suppliers by name search (live rows only) and return their ids. */
async function findSupplierIdsByName(page: Page, name: string): Promise<string[]> {
  const res = await page.request.get(
    `/api/store/suppliers?search=${encodeURIComponent(name)}&limit=100`,
  );
  const body = await json(res);
  const rows: any[] = body?.data?.suppliers ?? [];
  return rows.map((s) => s.id as string);
}

// ============================================================================
// §1 FUNCTIONAL & BUSINESS LOGIC — happy paths, validation, constraints
// ============================================================================

test.describe.serial('Module 6 — Suppliers Master (full-scope QA)', () => {
  test.describe.configure({ timeout: 180_000 });

  const state: { createdIds: string[]; tenant2Ids: string[] } = { createdIds: [], tenant2Ids: [] };

  // ── §1 Functional & business logic ─────────────────────────────────────────

  test('F1 suppliers page renders + Add Supplier sheet creates via UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 90_000 });
    // Gate on the shell's search input carrying React props BEFORE clicking —
    // a pre-hydration click on "Add Supplier" is silently swallowed.
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await expect(page.getByRole('button', { name: 'Add Supplier' })).toBeVisible();

    const name = `${RUN} UI Supplier`;
    const phone = nextPhone();
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    // Radix Sheet portals the title; here it IS a real heading (h2).
    await expect(page.getByRole('heading', { name: 'Add Supplier' })).toBeVisible({
      timeout: 30_000,
    });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(name);
    await page.locator('#phone').fill(phone);
    await page.getByRole('button', { name: 'Create Supplier', exact: true }).click();

    await expect(page.getByText('Supplier created')).toBeVisible({ timeout: 30_000 });

    // Resolve the id via API first (deterministic), then force a hard reload —
    // the client list can keep serving the pre-create page from the react-query
    // cache even after invalidateQueries fires (observed during QA).
    const ids = await findSupplierIdsByName(page, name);
    expect(ids.length, 'created supplier resolvable via API').toBe(1);
    if (ids[0]) state.createdIds.push(ids[0]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    // Search for the row — the default list is name-asc limit 20, so the new
    // supplier is not guaranteed to be on page 1.
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill(name);
    await expect(
      page.locator('tr', { hasText: name }).first(),
    ).toBeVisible({ timeout: 45_000 });
  });

  test('F2 API create 201 + full round-trip (contact/whatsapp/email/address/leadTime/notes)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = nextPhone();
    const payload = {
      name: `${RUN} Round Trip`,
      contactName: 'Kamala Perera',
      phone,
      whatsappNumber: '+94771234567',
      email: `${RUN}.rt@example.com`,
      address: '12 Galle Road, Colombo 03',
      leadTimeDays: 14,
      notes: 'Delivers Tuesdays. QA round-trip record.',
    };
    const { status, body } = await createSupplier(page, payload);
    expect(status, 'POST /api/store/suppliers → 201').toBe(201);
    expect(body?.data?.name).toBe(payload.name);
    expect(body?.data?.contactName).toBe(payload.contactName);
    expect(body?.data?.phone).toBe(phone);
    expect(body?.data?.whatsappNumber).toBe('+94771234567');
    expect(body?.data?.email).toBe(payload.email);
    expect(body?.data?.address).toBe(payload.address);
    expect(body?.data?.leadTimeDays).toBe(14);
    expect(body?.data?.notes).toBe(payload.notes);
    expect(body?.data?.isActive).toBe(true);
    if (body?.data?.id) state.createdIds.push(body.data.id);

    // GET reflects the same record + PO count.
    const get = await page.request.get(`/api/store/suppliers/${body.data.id}`);
    expect(get.status()).toBe(200);
    const got = await json(get);
    expect(got?.data?.phone).toBe(phone);
    expect(got?.data?._count?.purchaseOrders).toBe(0);
  });

  test('F3 whatsappNumber defaults to phone; PATCH "" resets to phone', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Create WITHOUT whatsapp → defaults to phone.
    const phone = nextPhone();
    const mk = await createSupplier(page, { name: `${RUN} WaDefault`, phone });
    expect(mk.status).toBe(201);
    expect(mk.body?.data?.whatsappNumber, 'whatsapp defaults to phone').toBe(phone);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // PATCH whatsappNumber:'' WITHOUT phone → null (schema allows literal("")).
    const p1 = await apiPatch(page, `/api/store/suppliers/${id}`, { whatsappNumber: '' });
    expect(p1.status(), 'PATCH whatsapp:"" → 200').toBe(200);
    expect((await json(p1))?.data?.whatsappNumber).toBeNull();

    // PATCH phone + whatsappNumber:'' → whatsapp follows the new phone.
    const newPhone = nextPhone();
    const p2 = await apiPatch(page, `/api/store/suppliers/${id}`, {
      phone: newPhone,
      whatsappNumber: '',
    });
    expect(p2.status()).toBe(200);
    const p2b = await json(p2);
    expect(p2b?.data?.phone).toBe(newPhone);
    expect(p2b?.data?.whatsappNumber, 'whatsapp reset to new phone').toBe(newPhone);
  });

  test('F4 edit via sheet persists (PATCH round-trip through UI)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = nextPhone();
    const mk = await createSupplier(page, { name: `${RUN} EditMe`, phone });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    // Search first — the default list is name-asc limit 20, so the row may
    // not be on page 1.
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill(`${RUN} EditMe`);

    // Open the edit sheet from the row's name button.
    const row = page.locator('tr', { hasText: `${RUN} EditMe` }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: `${RUN} EditMe` }).click();
    await expect(page.getByRole('heading', { name: 'Edit Supplier' })).toBeVisible({
      timeout: 30_000,
    });
    await waitForHydratedInput(page, '#name');

    // FIXED (BUG-34 / M06-04): the sheet now resets to the selected supplier
    // when it OPENS, so the very FIRST open after page load must already show
    // the row's values (previously it rendered blank and only a close→reopen
    // hydrated it — that workaround is now removed).
    await expect(page.locator('#name')).toHaveValue(`${RUN} EditMe`, { timeout: 15_000 });
    await expect(page.locator('#phone')).toHaveValue(phone, { timeout: 15_000 });
    await expect(page.locator('#leadTimeDays')).toHaveValue('7', {
      timeout: 15_000,
    });

    await page.locator('#name').fill(`${RUN} EditMe Renamed`);
    await page.locator('#contactName').fill('Nimal Silva');
    await page.getByRole('button', { name: 'Update Supplier', exact: true }).click();

    await expect(page.getByText('Supplier updated')).toBeVisible({ timeout: 30_000 });

    const get = await json(await page.request.get(`/api/store/suppliers/${id}`));
    expect(get?.data?.name).toBe(`${RUN} EditMe Renamed`);
    expect(get?.data?.contactName).toBe('Nimal Silva');
  });

  test('F5 validation contract: missing/invalid fields → 400 VALIDATION_ERROR', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const cases: Array<[string, Record<string, unknown>]> = [
      ['missing name', { phone: '0770000001' }],
      ['missing phone', { name: `${RUN} NoPhone` }],
      ['empty phone', { name: `${RUN} EmptyPhone`, phone: '' }],
      ['phone wrong format (11 digits)', { name: `${RUN} P11`, phone: '07712345678' }],
      ['phone wrong format (94 no plus)', { name: `${RUN} P94`, phone: '94771234567' }],
      ['phone letters', { name: `${RUN} PLetters`, phone: '077-123-456' }],
      ['name 101 chars', { name: 'x'.repeat(101), phone: '0770000002' }],
      ['contactName 101 chars', { name: `${RUN} C101`, phone: '0770000003', contactName: 'y'.repeat(101) }],
      ['invalid email', { name: `${RUN} BadEmail`, phone: '0770000004', email: 'not-an-email' }],
      ['bad whatsapp format', { name: `${RUN} BadWa`, phone: '0770000005', whatsappNumber: '12345' }],
      ['address 501 chars', { name: `${RUN} Addr`, phone: '0770000006', address: 'a'.repeat(501) }],
      ['leadTimeDays 0', { name: `${RUN} LT0`, phone: '0770000007', leadTimeDays: 0 }],
      ['leadTimeDays 366', { name: `${RUN} LT366`, phone: '0770000008', leadTimeDays: 366 }],
      ['leadTimeDays float', { name: `${RUN} LTFloat`, phone: '0770000009', leadTimeDays: 1.5 }],
      ['leadTimeDays null', { name: `${RUN} LTNull`, phone: '0770000010', leadTimeDays: null }],
      ['notes 1001 chars', { name: `${RUN} Notes`, phone: '0770000011', notes: 'n'.repeat(1001) }],
    ];

    for (const [label, payload] of cases) {
      const res = await apiPost(page, '/api/store/suppliers', payload);
      const body = await json(res);
      expect(res.status(), `${label} → 400`).toBe(400);
      expect(body?.error?.code ?? '', label).toBe('VALIDATION_ERROR');
    }
  });

  test('F6 boundary values accepted: name 100 / leadTime 1 & 365 / notes 1000', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mkMin = await createSupplier(page, {
      name: `${RUN} Min`,
      phone: nextPhone(),
      leadTimeDays: 1,
    });
    expect(mkMin.status, 'leadTimeDays=1 → 201').toBe(201);
    expect(mkMin.body?.data?.leadTimeDays).toBe(1);
    if (mkMin.body?.data?.id) state.createdIds.push(mkMin.body.data.id);

    const mkMax = await createSupplier(page, {
      name: 'X'.repeat(100),
      phone: nextPhone(),
      leadTimeDays: 365,
      notes: 'N'.repeat(1000),
      address: 'A'.repeat(500),
    });
    expect(mkMax.status, 'all-at-maximum → 201').toBe(201);
    expect((mkMax.body?.data?.name as string).length).toBe(100);
    expect(mkMax.body?.data?.leadTimeDays).toBe(365);
    expect((mkMax.body?.data?.notes as string).length).toBe(1000);
    if (mkMax.body?.data?.id) state.createdIds.push(mkMax.body.data.id);
  });

  test('F7 search filters by name, contactName and phone + pagination clamps', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = nextPhone();
    const mk = await createSupplier(page, {
      name: `${RUN} Searchable`,
      contactName: `${RUN} ContactGuy`,
      phone,
    });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // Name search finds it.
    const byName = await json(
      await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(`${RUN} Search`)}`),
    );
    expect(byName?.data?.suppliers.some((s: any) => s.id === id)).toBeTruthy();

    // contactName search finds it.
    const byContact = await json(
      await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(`${RUN} ContactGuy`)}`),
    );
    expect(byContact?.data?.suppliers.some((s: any) => s.id === id)).toBeTruthy();

    // FIXED (M06-05/OBS-9): phone is searchable now (exact/prefix via the
    // same contains-insensitive convention as name/contactName).
    const byPhone = await json(
      await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(phone)}`),
    );
    expect(
      byPhone?.data?.suppliers.some((s: any) => s.id === id),
      'exact-phone search finds the supplier',
    ).toBeTruthy();
    expect(byPhone?.data?.total).toBeGreaterThanOrEqual(1);

    // Pagination: limit=2 → ≤2 rows + totalPages computed.
    const p1 = await json(await page.request.get('/api/store/suppliers?page=1&limit=2'));
    expect(p1?.data?.suppliers.length).toBeLessThanOrEqual(2);
    expect(p1?.data?.totalPages).toBeGreaterThanOrEqual(1);

    // page=0 / negative / limit=0 clamp without error.
    const p0 = await page.request.get('/api/store/suppliers?page=0&limit=2');
    expect(p0.status()).toBe(200);
    const pNeg = await page.request.get('/api/store/suppliers?page=-5');
    expect(pNeg.status()).toBe(200);
    const big = await json(await page.request.get('/api/store/suppliers?limit=99999'));
    expect(big?.data?.suppliers.length).toBeLessThanOrEqual(100);
  });

  // ── §2 Financial & calculation precision ───────────────────────────────────

  test('P1 leadTimeDays integer precision + default 7 (no float drift)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // Omitted leadTimeDays → DB default 7.
    const mk = await createSupplier(page, { name: `${RUN} LeadDefault`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    expect(mk.body?.data?.leadTimeDays, 'default lead time is 7').toBe(7);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // PATCH to another exact integer — no float drift.
    const patch = await apiPatch(page, `/api/store/suppliers/${id}`, { leadTimeDays: 21 });
    expect(patch.status()).toBe(200);
    expect((await json(patch))?.data?.leadTimeDays).toBe(21);

    // UI renders the badge "N days". Search first — the default list is
    // name-asc limit 20, so the row may not be on page 1.
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill(`${RUN} LeadDefault`);
    const row = page.locator('tr', { hasText: `${RUN} LeadDefault` }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText('21 days')).toBeVisible();
  });

  test('P2 PO count column reflects purchaseOrders relation (0 for new supplier)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} PoCount`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    const detail = await json(await page.request.get(`/api/store/suppliers/${id}`));
    expect(detail?.data?._count?.purchaseOrders).toBe(0);

    // UI: PO Count cell renders 0 for the new supplier. Search first — the
    // default list is name-asc limit 20, so the row may not be on page 1.
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill(`${RUN} PoCount`);
    const row = page.locator('tr', { hasText: `${RUN} PoCount` }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText('0', { exact: true })).toBeVisible();
  });

  // ── §3 Cross-module cascade & ledger impact ────────────────────────────────

  test('L1 supplier is PO-ready: archive dialog copy promises POs unaffected', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} PoReady`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // The supplier is referenced by zero POs; the archive dialog explicitly
    // promises "Existing POs are not affected" — verify the copy is present
    // (cascade contract is exercised end-to-end in Module 16).
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill(`${RUN} PoReady`);
    const row = page.locator('tr', { hasText: `${RUN} PoReady` }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button').last().click();
    await expect(page.getByText(`Archive ${RUN} PoReady?`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Existing POs are not affected/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText(`Archive ${RUN} PoReady?`)).toBeHidden({ timeout: 15_000 });

    // Supplier still live after cancel.
    const get = await page.request.get(`/api/store/suppliers/${id}`);
    expect(get.status()).toBe(200);
    expect((await json(get))?.data?.isActive).toBe(true);
  });

  test('L2 archived supplier disappears from default list but POs keep their link', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} PoLink`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;

    expect(await archiveSupplier(page, id)).toBe(200);

    // Default list excludes it…
    const live = await json(
      await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(`${RUN} PoLink`)}`),
    );
    expect(live?.data?.total).toBe(0);

    // …but the record (and its purchaseOrders relation) still resolves by id —
    // existing POs keep their FK target (archive is a flag, not a delete).
    const get = await page.request.get(`/api/store/suppliers/${id}`);
    expect(get.status()).toBe(200);
    const got = await json(get);
    expect(got?.data?.isActive).toBe(false);
    expect(got?.data?._count?.purchaseOrders).toBe(0);
  });

  // ── §4 Audit trail, archive & immutability (no hard delete) ────────────────

  test('A1 archive is a soft-hide: isActive false, list excludes, GET still 200', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} SoftHide`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;

    const arch = await page.request.patch(`/api/store/suppliers/${id}/archive`);
    expect(arch.status(), 'archive → 200').toBe(200);
    expect((await json(arch))?.data?.archived).toBe(true);

    // Gone from the live list…
    const list = await json(
      await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(`${RUN} SoftHide`)}`),
    );
    expect(list?.data?.total).toBe(0);

    // …but GET by id still resolves (archived ≠ deleted).
    const get = await page.request.get(`/api/store/suppliers/${id}`);
    expect(get.status()).toBe(200);
    expect((await json(get))?.data?.isActive).toBe(false);

    // includeArchived=true reveals it again.
    const inc = await json(
      await page.request.get(
        `/api/store/suppliers?search=${encodeURIComponent(`${RUN} SoftHide`)}&includeArchived=true`,
      ),
    );
    expect(inc?.data?.total).toBe(1);
  });

  test('A2 no hard delete: DELETE → 405; double archive idempotent 200; unarchive round-trips', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} NoDelete`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // There is NO DELETE endpoint — the route file only exports GET/PATCH.
    const del = await page.request.delete(`/api/store/suppliers/${id}`);
    expect(del.status(), 'DELETE → 405 Method Not Allowed').toBe(405);

    // Archive is idempotent.
    expect(await archiveSupplier(page, id)).toBe(200);
    expect(await archiveSupplier(page, id), 'double archive → 200').toBe(200);

    // FIXED (M06-05/OBS-10): the explicit unarchive route closes the loop —
    // archive → unarchive → archive is a clean round-trip, and unarchive is
    // idempotent like its sibling.
    const un = await page.request.post(`/api/store/suppliers/${id}/unarchive`);
    expect(un.status(), 'unarchive → 200').toBe(200);
    expect((await json(un))?.data?.unarchived).toBe(true);
    expect((await json(await page.request.get(`/api/store/suppliers/${id}`)))?.data?.isActive).toBe(true);
    const un2 = await page.request.post(`/api/store/suppliers/${id}/unarchive`);
    expect(un2.status(), 'double unarchive → 200').toBe(200);
    expect(await archiveSupplier(page, id), 're-archive after unarchive → 200').toBe(200);
  });

  test('A3 archived rows remain GET-able; PATCH blocked 409 until restored', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} ArchEdit`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    expect(await archiveSupplier(page, id)).toBe(200);

    // FIXED (M06-05/OBS-11): archived rows stay readable by id (PO history
    // links need them) but are read-only — editing requires the explicit
    // unarchive path first (restore-first policy, typed 409).
    const get = await page.request.get(`/api/store/suppliers/${id}`);
    expect(get.status(), 'GET archived by id → 200').toBe(200);

    const patch = await apiPatch(page, `/api/store/suppliers/${id}`, {
      name: `${RUN} ArchEdit Renamed`,
    });
    const body = await json(patch);
    expect(patch.status(), 'PATCH archived by id → 409 (restore first)').toBe(409);
    expect(body?.error?.code ?? '').toBe('CONFLICT');
    expect(String(body?.error?.message ?? '')).toContain('restored before editing');

    // Restore → the same PATCH succeeds again.
    expect((await page.request.post(`/api/store/suppliers/${id}/unarchive`)).status()).toBe(200);
    const patch2 = await apiPatch(page, `/api/store/suppliers/${id}`, {
      name: `${RUN} ArchEdit Renamed`,
    });
    expect(patch2.status(), 'PATCH after unarchive → 200').toBe(200);
    expect((await json(patch2))?.data?.name).toBe(`${RUN} ArchEdit Renamed`);
  });

  test('A4 unknown id → 404 on GET / PATCH / archive', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const get = await page.request.get('/api/store/suppliers/nonexistent-id-123');
    expect(get.status(), 'GET unknown id → 404').toBe(404);
    expect((await json(get))?.error?.code ?? '').toBe('NOT_FOUND');

    const patch = await apiPatch(page, '/api/store/suppliers/nonexistent-id-123', {
      name: 'ghost',
    });
    expect(patch.status(), 'PATCH unknown id → 404').toBe(404);

    const arch = await page.request.patch('/api/store/suppliers/nonexistent-id-123/archive');
    expect(arch.status(), 'archive unknown id → 404').toBe(404);
  });

  // ── §5 Chaos, button spamming & race conditions ────────────────────────────

  test('R1 double-click Create Supplier submits exactly ONE supplier', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');

    const name = `${RUN} DblClick`;
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await expect(page.getByRole('heading', { name: 'Add Supplier' })).toBeVisible({
      timeout: 30_000,
    });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(name);
    await page.locator('#phone').fill(nextPhone());

    const createBtn = page.getByRole('button', { name: 'Create Supplier', exact: true });
    await createBtn.dblclick();

    await expect(page.getByText('Supplier created').first()).toBeVisible({ timeout: 30_000 });
    const ids = await findSupplierIdsByName(page, name);
    expect(ids.length, 'exactly one supplier created').toBe(1);
    for (const id of ids) state.createdIds.push(id);
  });

  test('R2 3-way concurrent same-phone create: one 201, two 409 (BUG-30 fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = nextPhone();
    const results = await Promise.all(
      [1, 2, 3].map((i) =>
        createSupplier(page, { name: `${RUN} Race ${i}`, phone }),
      ),
    );
    const statuses = results.map((r) => r.status);
    // FIXED (M06-01/D5): @@unique([tenantId, phone]) closes the dedup-free
    // directory — the service pre-check wins sequentially, concurrent losers
    // hit the DB constraint (P2002 → 409 via mapPrismaError). Exactly one 201.
    expect(statuses.filter((s) => s >= 500).length, 'zero 500s under race').toBe(0);
    expect(statuses.filter((s) => s === 201).length, 'exactly one winner').toBe(1);
    expect(statuses.filter((s) => s === 409).length, 'two friendly 409 losers').toBe(2);

    for (const r of results) {
      if (r.status === 201 && r.body?.data?.id) state.createdIds.push(r.body.data.id);
    }
  });

  // ── §6 Hardware & device simulation ────────────────────────────────────────

  test('H1 scanner-style rapid keystrokes into search filter the grid', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} Scan`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search suppliers…').first();
    await expect(search).toBeVisible();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');

    // Simulate a keyboard-wedge scanner: characters in rapid bursts.
    await search.pressSequentially(`${RUN} Scan`, { delay: 15 });
    await expect(
      page.locator('tr', { hasText: `${RUN} Scan` }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('H2 paste-heavy input (clipboard-style) into address + notes fields', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');

    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await expect(page.getByRole('heading', { name: 'Add Supplier' })).toBeVisible({
      timeout: 30_000,
    });
    await waitForHydratedInput(page, '#name');

    // Simulate a paste of a large multi-line block (warehouse address dump) —
    // 12 lines ≈ 380 chars, safely under the 500-char address limit.
    const bigAddress = Array.from(
      { length: 12 },
      (_, i) => `Line ${i + 1} of warehouse address`,
    ).join('\n');
    expect(bigAddress.length, 'paste payload within address limit').toBeLessThanOrEqual(500);
    await page.locator('#name').fill(`${RUN} Paste`);
    await page.locator('#phone').fill(nextPhone());
    await page.locator('#address').fill(bigAddress);
    await page.getByRole('button', { name: 'Create Supplier', exact: true }).click();

    await expect(page.getByText('Supplier created')).toBeVisible({ timeout: 30_000 });
    const ids = await findSupplierIdsByName(page, `${RUN} Paste`);
    expect(ids.length).toBe(1);
    for (const id of ids) state.createdIds.push(id);

    const got = await json(await page.request.get(`/api/store/suppliers/${ids[0]}`));
    expect(got?.data?.address).toBe(bigAddress);
  });

  // ── §7 Network resilience & offline sync ───────────────────────────────────

  test('N1 list API 500 → page degrades gracefully (no white-screen)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.route('**/api/store/suppliers?**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }),
    );
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2_000);

    // The shell survives; no uncaught exceptions escape the ErrorBoundary.
    expect(pageErrors, 'no uncaught page errors').toEqual([]);
    await expect(page.getByRole('button', { name: 'Add Supplier' })).toBeVisible();
  });

  test('N2 create API 504 → error toast, sheet stays interactive', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');

    await page.route('**/api/store/suppliers', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 504, contentType: 'application/json', body: '{"success":false}' });
      }
      return route.continue();
    });

    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await expect(page.getByRole('heading', { name: 'Add Supplier' })).toBeVisible({
      timeout: 30_000,
    });
    await waitForHydratedInput(page, '#name');
    await page.locator('#name').fill(`${RUN} Timeout`);
    await page.locator('#phone').fill(nextPhone());
    await page.getByRole('button', { name: 'Create Supplier', exact: true }).click();

    await expect(page.getByText(/something went wrong|network error|failed/i).first()).toBeVisible({
      timeout: 30_000,
    });
    // Sheet remains open and interactive.
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Supplier', exact: true })).toBeEnabled();
  });

  // ── §8 Security, RBAC & tenant isolation ───────────────────────────────────

  test('S1 unauthenticated: APIs 401, pages redirect to /login', async ({ page }) => {
    const apiRes = await page.request.get('/api/store/suppliers');
    expect(apiRes.status(), 'unauth list → 401').toBe(401);

    const postRes = await apiPost(page, '/api/store/suppliers', { name: 'x', phone: '0770000099' });
    expect(postRes.status(), 'unauth create → 401').toBe(401);

    const archRes = await page.request.patch('/api/store/suppliers/whatever/archive');
    expect(archRes.status(), 'unauth archive → 401').toBe(401);

    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test('S2 CASHIER: page loads (no page gate) but every supplier API 403s', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);

    // Page accessible — (store) layout is auth-only, no permission gate.
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });

    // All four supplier operations are forbidden (no supplier:* permissions).
    const get = await page.request.get('/api/store/suppliers');
    expect(get.status(), 'cashier GET → 403').toBe(403);

    const post = await apiPost(page, '/api/store/suppliers', {
      name: `${RUN} Cashier`,
      phone: nextPhone(),
    });
    expect(post.status(), 'cashier POST → 403').toBe(403);

    const patch = await apiPatch(page, '/api/store/suppliers/whatever', { name: 'nope' });
    expect(patch.status(), 'cashier PATCH → 403').toBe(403);

    const arch = await page.request.patch('/api/store/suppliers/whatever/archive');
    expect(arch.status(), 'cashier archive → 403').toBe(403);
  });

  test('S3 cross-tenant: foreign supplier 404; same phone allowed per-tenant', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const phone = nextPhone();
    const mk = await createSupplier(page, { name: `${RUN} Isolated`, phone });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    // Tenant 2 owner cannot see, edit, or archive tenant 1's supplier.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    const get = await page.request.get(`/api/store/suppliers/${id}`);
    expect(get.status(), 'cross-tenant GET → 404').toBe(404);
    const patch = await apiPatch(page, `/api/store/suppliers/${id}`, { name: 'hacked' });
    expect(patch.status(), 'cross-tenant PATCH → 404').toBe(404);
    const arch = await page.request.patch(`/api/store/suppliers/${id}/archive`);
    expect(arch.status(), 'cross-tenant archive → 404').toBe(404);

    // Same phone is allowed on the other tenant (no unique constraint).
    const re = await createSupplier(page, { name: `${RUN} Tenant2`, phone });
    expect(re.status, 'same phone on tenant 2 → 201').toBe(201);
    if (re.body?.data?.id) state.tenant2Ids.push(re.body.data.id);
  });

  // ── §9 Boundary inputs & chaos data ────────────────────────────────────────

  test('X1 Sinhala / Tamil / emoji names round-trip intact', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const name = `සමඟ ${RUN} தமிழ் 🌿`;
    const mk = await createSupplier(page, { name, phone: nextPhone() });
    expect(mk.status, 'unicode name → 201').toBe(201);
    expect(mk.body?.data?.name).toBe(name);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    // Rendered intact in the UI.
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill(`${RUN} தமிழ்`);
    await expect(page.locator('tr', { hasText: 'தமிழ்' }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('X2 stored XSS is inert in the UI (React escaping)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const xssName = `<img src=x onerror=window.__m06xss=1>`;
    const mk = await createSupplier(page, { name: xssName, phone: nextPhone() });
    expect(mk.status, 'XSS payload stored (≤100 chars) → 201').toBe(201);
    if (mk.body?.data?.id) state.createdIds.push(mk.body.data.id);

    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    const search = page.getByPlaceholder('Search suppliers…').first();
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');
    await search.fill('<img src=x');
    await expect(page.locator('tr', { hasText: '<img src=x' }).first()).toBeVisible({
      timeout: 30_000,
    });

    const fired = await page.evaluate(() => (window as any).__m06xss);
    expect(fired, 'onerror handler must never execute').toBeUndefined();
  });

  test('X3 chaos payloads never 500; server-owned fields ignore forgery', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const chaos: Array<[string, Record<string, unknown>]> = [
      ['null name', { name: null, phone: '0770000021' }],
      ['number name', { name: 12345, phone: '0770000022' }],
      ['array phone', { name: `${RUN} ArrPhone`, phone: ['07', '1'] }],
      ['__proto__ + unknown keys', {
        name: `${RUN} Proto`,
        phone: nextPhone(),
        __proto__: { admin: true },
        unknownKey: 'x',
        isActive: false,
        tenantId: 'tenant-2-id',
        createdAt: '1999-01-01T00:00:00Z',
      }],
    ];

    for (const [label, payload] of chaos) {
      const res = await apiPost(page, '/api/store/suppliers', payload);
      expect(res.status(), `${label} must not 500`).toBeLessThan(500);
    }

    // Forgery pin: server-owned fields win (isActive/tenantId/createdAt are
    // never read from the payload).
    const forged = await createSupplier(page, {
      name: `${RUN} Forgery`,
      phone: nextPhone(),
      isActive: false,
      createdAt: '1999-01-01T00:00:00Z',
    });
    expect(forged.status).toBe(201);
    expect(forged.body?.data?.isActive).toBe(true);
    expect(String(forged.body?.data?.createdAt).startsWith('1999')).toBeFalsy();
    if (forged.body?.data?.id) state.createdIds.push(forged.body.data.id);

    const protoPhone = String(chaos[3]?.[1]?.phone ?? '');
    if (typeof protoPhone === 'string' && protoPhone.startsWith('07')) {
      const protoIds = await findSupplierIdsByName(page, `${RUN} Proto`);
      for (const id of protoIds) state.createdIds.push(id);
    }
  });

  test('X4 filter chaos: non-numeric page/limit → 400 naming the param (BUG-32 fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    // FIXED (XC-01): parseQueryInt rejects malformed values with a typed 400
    // naming the param instead of NaN reaching Prisma's skip/take (BUG-32).
    const pageAbc = await page.request.get('/api/store/suppliers?page=abc');
    expect(pageAbc.status(), 'page=abc → 400 (BUG-32 fixed)').toBe(400);
    expect(((await pageAbc.json()).error ?? {}).message).toContain('page');

    const limitAbc = await page.request.get('/api/store/suppliers?limit=abc');
    expect(limitAbc.status(), 'limit=abc → 400 (BUG-32 fixed)').toBe(400);
  });

  // ── §10 Time-travel & retroactive dates ────────────────────────────────────

  test('T1 createdAt forgery ignored; updatedAt advances on PATCH', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, {
      name: `${RUN} TimeTravel`,
      phone: nextPhone(),
      createdAt: '1999-01-01T00:00:00Z',
      updatedAt: '1999-01-01T00:00:00Z',
    });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    expect(String(mk.body?.data?.createdAt).startsWith('1999')).toBeFalsy();
    expect(String(mk.body?.data?.updatedAt).startsWith('1999')).toBeFalsy();

    // PATCH advances updatedAt (@updatedAt) but never rewinds createdAt.
    const before = mk.body?.data;
    await page.waitForTimeout(1_100);
    const patch = await apiPatch(page, `/api/store/suppliers/${id}`, { notes: 'touched' });
    expect(patch.status()).toBe(200);
    const after = await json(patch);
    expect(String(after?.data?.createdAt)).toBe(String(before?.createdAt));
    expect(new Date(after?.data?.updatedAt).getTime()).toBeGreaterThan(
      new Date(before?.updatedAt).getTime(),
    );
  });

  test('T2 leadTimeDays accepts the full 1..365 domain after update', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    const mk = await createSupplier(page, { name: `${RUN} LtDomain`, phone: nextPhone() });
    expect(mk.status).toBe(201);
    const id = mk.body?.data?.id as string;
    state.createdIds.push(id);

    for (const days of [1, 30, 180, 365]) {
      const patch = await apiPatch(page, `/api/store/suppliers/${id}`, { leadTimeDays: days });
      expect(patch.status(), `leadTimeDays=${days} → 200`).toBe(200);
      expect((await json(patch))?.data?.leadTimeDays).toBe(days);
    }

    // Out-of-domain rejected on PATCH too.
    const bad = await apiPatch(page, `/api/store/suppliers/${id}`, { leadTimeDays: 366 });
    expect(bad.status(), 'PATCH leadTimeDays=366 → 400').toBe(400);
  });

  // ── UI defect pins ─────────────────────────────────────────────────────────

  test('B1 BUG-33 pin (FIXED): cleared leadTimeDays submits cleanly → default 7', async ({ page }) => {
    // FIXED (M06-03): clearing the defaulted leadTimeDays input used to make
    // react-hook-form submit NaN (valueAsNumber on an empty field) and the
    // standard-schema resolver surfaced the raw zod message "expected number,
    // received NaN". The register now coerces empty/invalid to undefined, so
    // the optional field validates and the API default (7) applies. A valid
    // integer still round-trips unchanged.
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 60_000 });
    await waitForHydratedInput(page, 'input[placeholder="Search suppliers…"]');

    // Assert each create on its OWN POST response body (not a shared toast —
    // the first create's toast is still visible when the second case starts,
    // so a toast/search check races). The create response carries the
    // persisted leadTimeDays (+ duplicateName from M06-01).
    const createAndReadLeadTime = async (label: string, leadTime: string): Promise<number> => {
      await page.getByRole('button', { name: 'Add Supplier' }).click();
      await expect(page.getByRole('heading', { name: 'Add Supplier' })).toBeVisible({
        timeout: 30_000,
      });
      await waitForHydratedInput(page, '#name');
      await page.locator('#name').fill(`${RUN} ${label}`);
      await page.locator('#phone').fill(nextPhone());
      await page.locator('#leadTimeDays').fill(leadTime);
      const resPromise = page.waitForResponse(
        (r) => r.url().includes('/api/store/suppliers') && r.request().method() === 'POST',
        { timeout: 30_000 },
      );
      await page.getByRole('button', { name: 'Create Supplier', exact: true }).click();
      const res = await resPromise;
      expect(res.status(), `${label}: create → 201`).toBe(201);
      const body = await res.json();
      if (body?.data?.id) state.createdIds.push(body.data.id);
      return Number(body?.data?.leadTimeDays);
    };

    // Cleared lead time → no raw NaN message, API default 7 applies.
    const lt = await createAndReadLeadTime('ClearLT', '');
    await expect(page.getByText(/expected number, received NaN/i)).toBeHidden();
    expect(lt, 'empty lead time → API default 7').toBe(7);

    // A valid integer still round-trips unchanged.
    const lt5 = await createAndReadLeadTime('KeepLT5', '5');
    expect(lt5, 'valid integer lead time persists').toBe(5);
  });

  test('B2 BUG-30/31 pin (FIXED): duplicate phone → 409, duplicate name → 201 + flag', async ({ page }) => {
    // FIXED (M06-01 / D5 client decision): phone is the contact key — hard
    // unique per tenant (DB @@unique + friendly pre-check 409). Name is NOT
    // unique: a duplicate name still creates (201) but the response data
    // carries a duplicateName warning flag. Two same-name live rows coexist.
    await login(page, OWNER.email, OWNER.password);

    const phone = nextPhone();
    const a = await createSupplier(page, { name: `${RUN} DupTarget`, phone });
    expect(a.status).toBe(201);
    expect(a.body?.data?.duplicateName, 'first create: no name clash').toBe(false);
    if (a.body?.data?.id) state.createdIds.push(a.body.data.id);

    const dupPhone = await createSupplier(page, { name: `${RUN} DupOther`, phone });
    expect(dupPhone.status, 'duplicate phone → 409 (BUG-30 fixed)').toBe(409);
    expect(dupPhone.body?.error?.code ?? '').toBe('CONFLICT');
    expect(String(dupPhone.body?.error?.message ?? '')).toContain('phone number already exists');

    const dupName = await createSupplier(page, {
      name: `${RUN} DupTarget`,
      phone: nextPhone(),
    });
    expect(dupName.status, 'duplicate name → 201 (D5 warn-only)').toBe(201);
    expect(dupName.body?.data?.duplicateName, 'duplicate-name flag surfaces').toBe(true);
    if (dupName.body?.data?.id) state.createdIds.push(dupName.body.data.id);

    // Both same-name rows are live simultaneously.
    const ids = await findSupplierIdsByName(page, `${RUN} DupTarget`);
    expect(ids.length, 'two live rows share one name').toBe(2);
  });

  // ── Cleanup (Appendix C.7 pattern, adapted: no delete API exists) ──────────

  test('cleanup: archive + rename every supplier created by this run', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);

    let retired = 0;
    const retire = async (id: string) => {
      await apiPatch(page, `/api/store/suppliers/${id}`, {
        name: `ZZZ-RETIRED-${RUN}-${id.slice(-6)}`,
      });
      const status = await archiveSupplier(page, id);
      if (status === 200) retired++;
    };

    for (const id of state.createdIds) await retire(id);

    // Tenant-2 records need the tenant-2 session.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    for (const id of state.tenant2Ids) await retire(id);

    // Sweep: any RUN-suffixed stragglers (e.g. chaos rows without captured
    // ids) plus leftover rows from the disposable probe runs (m06p*/m06e*).
    await login(page, OWNER.email, OWNER.password);
    for (const marker of [RUN, 'm06p', 'm06e']) {
      const sweep = await json(
        await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(marker)}&limit=100`),
      );
      for (const s of sweep?.data?.suppliers ?? []) {
        if (String(s.name ?? '').includes(marker)) await retire(s.id);
      }
    }

    // Verify: no live RUN-suffixed suppliers remain.
    const verify = await json(
      await page.request.get(`/api/store/suppliers?search=${encodeURIComponent(RUN)}&limit=100`),
    );
    expect(verify?.data?.total, 'no live RUN-suffixed suppliers remain').toBe(0);
    expect(retired, 'cleanup retired this run’s records').toBeGreaterThan(0);
  });
});
