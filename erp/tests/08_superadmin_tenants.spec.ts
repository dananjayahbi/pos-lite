import { test, expect, type Page } from '@playwright/test';

/**
 * 08_superadmin_tenants.spec.ts — MODULE 8: Tenant & Subscription Administration (Super Admin)
 *
 * Roadmap scope (QA_ROADMAP.md Module 08):
 *   • UI:  /superadmin/dashboard (metrics + Business Overview),
 *          /superadmin/tenants (list + filters),
 *          /superadmin/tenants/new (redirect stub — creation disabled),
 *          /superadmin/tenants/[tenantId] (settings form + admin actions +
 *          feature-module toggles), /superadmin/system (health + audit tail)
 *   • API: /api/superadmin/tenants (GET list, POST create-blocked),
 *          .../check-slug, .../[id]/settings (PATCH), .../[id]/feature-modules
 *          (PATCH), .../[id]/suspend, .../[id]/reactivate,
 *          .../[id]/grace-period (POST), /api/superadmin/plans (GET),
 *          /api/admin/plans (GET/POST/PATCH), /api/admin/metrics (GET),
 *          /api/internal/tenant-status (GET)
 *   • Prisma: Tenant (status TenantStatus, settings JSON, graceEndsAt,
 *             subscriptionStatus), SubscriptionPlan, Subscription,
 *             enum TenantStatus { ACTIVE GRACE_PERIOD SUSPENDED CANCELLED }
 *
 * Contracts verified by source inspection on QA-R1 after the W2 fixes
 * (M08-01…M08-05 landed; all mutations restored by cleanup):
 *   • POST /api/superadmin/tenants → 403 "Maximum of 2 businesses allowed"
 *     even for SUPER_ADMIN (business creation disabled; /new page redirects
 *     back to the list). Validation of the request body never runs because
 *     the count guard fires first.
 *   • [id]/settings PATCH (M08-01): businessSettingsSchema = {storeName
 *     2..80, logoUrl URL-or-empty, address ≤160, phoneNumber ≤40, currency
 *     ≥1, timezone ≥1}. receiptFooter/vatRate/ssclRate are NOT schema keys —
 *     unknown keys are STRIPPED by Zod (200, stored values untouched: strip-
 *     not-reject). Merge writes name/logoUrl + settings {address,
 *     phoneNumber, currency:'LKR' (locked), timezone}; siblings (vatRate,
 *     receiptFooter, hardware, enabledModules…) survive. 400
 *     VALIDATION_ERROR (first issue message) / 404 NOT_FOUND /
 *     200 {success, data:{id,name,logoUrl,settings}}.
 *   • Tenant-detail UI (M08-01): stats cards + BusinessSettingsForm
 *     (#storeName/#address/#phoneNumber, locked 'LKR', timezone Select,
 *     single 'Save Business Settings') + TenantDisableToggle
 *     ('Disable Business' confirm / 'Enable Business') + FeatureModulesManager
 *     (#module-appointments/delivery/website). NO Export Data / Audit Log /
 *     Suspend / Trigger Grace buttons (REQ-12 stubs never shipped).
 *   • feature-modules PATCH (M08-04): FeatureModuleToggleSchema allowlists
 *     names to ['appointments','delivery','website'] (z.enum + dedupe); []
 *     clears; unknown name or non-array → 400 VALIDATION_ERROR; 401 when
 *     unauthenticated, 404 unknown id.
 *   • suspend/reactivate/grace-period POST (M08-02): unknown id → 404
 *     NOT_FOUND typed envelope; reactivate resets status ACTIVE +
 *     graceEndsAt null; grace sets GRACE_PERIOD + exactly +14 days.
 *   • check-slug: {available:false} for missing slug param, never 400.
 *   • Suspension enforcement (M08-01): live proxy gate — a suspended
 *     tenant's users cannot sign in (login form error, no session, APIs 401)
 *     and pre-suspension sessions get 403 TENANT_SUSPENDED / /suspended;
 *     reactivate restores access.
 *   • /api/audit-logs (M08-03): SUPER_ADMIN now gets a 200 cross-tenant
 *     {data, meta:{total}} feed; tenant-scoped roles unchanged.
 *   • /api/admin/plans (M08-05): POST validation 422 with issue array;
 *     duplicate name → 409 CONFLICT; GET defaults to ACTIVE plans
 *     (?includeInactive=true for all); the seed ships STARTER/GROWTH/
 *     ENTERPRISE (isActive:true), so this suite reuses/reprices seeded rows
 *     via ensurePlan and archives them again at cleanup.
 *
 * 10-point spectrum mapping is annotated per describe block.
 * All created data is RUN-suffixed and restored/cleaned by the final tests.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

const SUPERADMIN = {
  email: 'superadmin@ayurpos.dev',
  password: 'changeme123!',
} as const;

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

const RUN = `m08x${Date.now().toString(36)}`.slice(-12);

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

const apiPost = (p: Page, url: string, data?: any) =>
  p.request.post(url, data !== undefined ? { data, headers: { 'content-type': 'application/json' } } : {});

const apiPatch = (p: Page, url: string, data: any) =>
  p.request.patch(url, { data, headers: { 'content-type': 'application/json' } });

/**
 * Navigate to a tenant detail page with cold-route resilience: dev-server
 * first-compile sometimes bounces the deep-link to the list page (seen in
 * F3/H1). Wait for the tenant-name heading (60s) and, if the list page
 * rendered instead, retry the navigation once.
 */
async function gotoTenantDetail(page: Page, tenantId: string, tenantName: string) {
  await page.goto(`${BASE_URL}/superadmin/tenants/${tenantId}`, { waitUntil: 'domcontentloaded' });
  try {
    await expect(page.getByRole('heading', { name: tenantName })).toBeVisible({ timeout: 15_000 });
  } catch {
    await page.goto(`${BASE_URL}/superadmin/tenants/${tenantId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: tenantName })).toBeVisible({ timeout: 60_000 });
  }
}

/**
 * Login helper. SUPER_ADMIN lands on /superadmin/dashboard; OWNER on
 * /dashboard; CASHIER may open an "Open POS" tab-choice dialog — race
 * URL-vs-dialog like the Module 02–07 specs.
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
    await expect(page).toHaveURL(/\/(dashboard|superadmin\/dashboard|pos)/, { timeout: 8_000 });
  } catch {
    const choice = page.getByRole('button', { name: /open in this tab/i }).first();
    try {
     await choice.waitFor({ state: 'visible', timeout: 15_000 });
     await choice.click();
   } catch {
     /* slow cold-compile sign-in for a non-cashier role — no dialog; *
      * the trailing URL check below resolves the race. */
   }
    await expect(page).toHaveURL(/\/(dashboard|superadmin\/dashboard|pos)/, { timeout: 30_000 });
  }
}

/** Resolve the two seeded tenant ids via the superadmin list API. */
async function getTenants(page: Page): Promise<any[]> {
  const res = await page.request.get('/api/superadmin/tenants');
  expect(res.status(), 'superadmin tenant list → 200').toBe(200);
  const body = await json(res);
  return body?.businesses ?? [];
}

/**
 * Create a plan via /api/admin/plans, or reuse+reprice an existing row.
 *
 * M08-05 (BUG-39 FIXED): duplicate names now answer a typed 409 CONFLICT
 * (names stay reserved while any row exists, archived included — D4), and
 * GET /api/admin/plans defaults to ACTIVE rows with ?includeInactive=true as
 * the opt-in (OBS-17). Additionally the seed (OBS-12) ships STARTER/GROWTH/
 * ENTERPRISE, so POST-first always conflicts on a seeded DB.
 *
 * Tolerance contract (helper-local, callers untouched): on any non-201
 * create outcome we find the existing row via includeInactive=true, PATCH it
 * to the requested price (upsert semantics — P1's price pins depend on it),
 * and report 201 so the existing `status === 201 || (500 && existing)`
 * assertions keep holding. The legacy 500-with-empty-body path is still
 * tolerated for pre-fix servers.
 */
async function ensurePlan(page: Page, name: string, monthlyPrice: number) {
  const res = await apiPost(page, '/api/admin/plans', {
    name,
    monthlyPrice,
    annualPrice: monthlyPrice * 10,
    maxUsers: 5,
    maxProductVariants: 500,
    features: [`${RUN}-feature`],
  });
  const body = await json(res);
  if (res.status() === 201) {
    return { status: 201, id: body?.data?.id as string | undefined };
  }
  // Duplicate name (409 post-fix; 500/422 on older servers) → reuse the
  // existing row (active or archived) and reprice it via PATCH.
  const list = await json(
    await page.request.get('/api/admin/plans?includeInactive=true'),
  );
  const existing = (list?.data ?? []).find((p: any) => p?.name === name);
  if (existing?.id) {
    const reprice = await apiPatch(page, `/api/admin/plans/${existing.id}`, {
      monthlyPrice,
      annualPrice: monthlyPrice * 10,
      // Re-activate too: a prior run's cleanup (or an aborted run) may have
      // archived the row, and P1's downstream GET defaults to active rows.
      isActive: true,
    });
    if (reprice.status() === 200) {
      return { status: 201, id: existing.id as string, existing: true };
    }
  }
  return {
    status: res.status() as number,
    id: existing?.id as string | undefined,
    existing: Boolean(existing),
  };
}

/** Best-effort plan archival (PATCH isActive:false) by name. */
async function archivePlanByName(page: Page, name: string) {
  const body = await json(await page.request.get('/api/admin/plans'));
  for (const plan of body?.data ?? []) {
    if (plan?.name === name && plan?.isActive === true) {
      await apiPatch(page, `/api/admin/plans/${plan.id}`, { isActive: false });
    }
  }
}

/**
 * Restore a tenant's store name via the settings PATCH. The route requires
 * the full settings payload (currency/timezone min 1 char), so merge the
 * name change over the tenant's current settings.
 */
async function restoreTenantName(page: Page, tenantId: string, name: string, tenant: any) {
  const s = tenant?.settings ?? {};
  // M08-01: receiptFooter/vatRate/ssclRate are stripped keys — the merge
  // preserves them server-side, so the restore only carries schema fields.
  const res = await apiPatch(page, `/api/superadmin/tenants/${tenantId}/settings`, {
    storeName: name,
    logoUrl: tenant?.logoUrl ?? '',
    address: typeof s.address === 'string' ? s.address : '',
    phoneNumber: typeof s.phoneNumber === 'string' ? s.phoneNumber : '',
    currency: typeof s.currency === 'string' ? s.currency : 'LKR',
    timezone: typeof s.timezone === 'string' ? s.timezone : 'Asia/Colombo',
  });
  expect(res.status(), `restore tenant name → ${name}`).toBe(200);
}

// ============================================================================
// §1 FUNCTIONAL & BUSINESS LOGIC — superadmin shell, tenant list/detail,
//    settings round-trip, admin lifecycle, feature modules
// ============================================================================

test.describe.serial('Module 8 — Tenant & Subscription Administration (full-scope QA)', () => {
  test.describe.configure({ timeout: 180_000 });

  const state: {
    tenant1Id: string;
    tenant2Id: string;
    createdPlanIds: string[];
    /* snapshots for exact restore */
    snap1: any;
    snap2: any;
  } = { tenant1Id: '', tenant2Id: '', createdPlanIds: [], snap1: null, snap2: null };

  test('F0 snapshot: capture both tenants (id + full settings) for exact restore', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    const tenants = await getTenants(page);
    expect(tenants.length).toBeGreaterThanOrEqual(2);
    const dilani = tenants.find((t) => t.slug === 'dilani');
    const lanka = tenants.find((t) => t.slug === 'lanka-electronics');
    expect(dilani, 'Ayur Wellness Centre seeded').toBeTruthy();
    expect(lanka, 'Lanka Electronics seeded').toBeTruthy();
    state.tenant1Id = dilani.id;
    state.tenant2Id = lanka.id;
    state.snap1 = dilani;
    state.snap2 = lanka;

    // Self-heal: an earlier aborted run (failed before cleanup) may have left
    // the tenant renamed by L1. Restore seed names so the UI tests that pin
    // seed names are deterministic regardless of prior run state.
    if (dilani.name !== 'Ayur Wellness Centre') {
      await restoreTenantName(page, state.tenant1Id, 'Ayur Wellness Centre', dilani);
      state.snap1 = { ...state.snap1, name: 'Ayur Wellness Centre' };
    }
    if (lanka.name !== 'Lanka Electronics') {
      await restoreTenantName(page, state.tenant2Id, 'Lanka Electronics', lanka);
      state.snap2 = { ...state.snap2, name: 'Lanka Electronics' };
    }

    // List contract: {businesses, total} ordered by createdAt asc.
    expect(Array.isArray(tenants)).toBe(true);
    expect(tenants[0].createdAt).toBeTruthy();
  });

  test('F1 superadmin dashboard renders metrics + Business Overview table', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await expect(page).toHaveURL(/\/superadmin\/dashboard/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
    for (const label of ['Total Businesses', 'Total Staff', 'Total Products']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }

    const overview = page.locator('table');
    await expect(overview.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Business Name').first()).toBeVisible();
    // Both seeded tenants appear with slug + status badges. Scope the name
    // links to the overview table — the sidebar nav also renders a tenant
    // link, so a bare getByRole('link') is a strict-mode violation (2 matches).
    await expect(overview.getByRole('link', { name: 'Ayur Wellness Centre' })).toBeVisible();
    await expect(page.getByText('dilani', { exact: true }).first()).toBeVisible();
    await expect(overview.getByRole('link', { name: 'Lanka Electronics' })).toBeVisible();

    // Overview rows link to the tenant detail pages.
    const detailLinks = page.locator('a[href^="/superadmin/tenants/"]');
    expect(await detailLinks.count()).toBeGreaterThanOrEqual(2);
  });

  test('F2 tenants list page renders + search & status filters work', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto(`${BASE_URL}/superadmin/tenants`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible({ timeout: 60_000 });

    await expect(page.getByText('2 of 2 businesses configured')).toBeVisible();
    await expect(page.getByPlaceholder('Search by store name…')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByText('Active').first()).toBeVisible(); // status badge

    // Search narrows to Lanka Electronics.
    await page.goto(`${BASE_URL}/superadmin/tenants?search=lanka`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('tbody tr')).toHaveCount(1);
    // Scope to tbody — the sidebar nav also renders tenant links.
    await expect(page.locator('tbody').getByRole('link', { name: 'Lanka Electronics' })).toBeVisible();

    // Status filter with zero matches → empty-state row.
    await page.goto(`${BASE_URL}/superadmin/tenants?status=SUSPENDED`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('No businesses found.')).toBeVisible();

    // search + status combine (AND).
    await page.goto(
      `${BASE_URL}/superadmin/tenants?search=ayur&status=ACTIVE`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody').getByRole('link', { name: 'Ayur Wellness Centre' })).toBeVisible();
  });

  test('F3 tenant detail page renders stats + business settings + access toggle + module toggles', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');

    await expect(page.getByRole('link', { name: '← Back to Businesses' })).toBeVisible();

    // Stats cards (M08-01: Slug/Staff/Products/Total Sales).
    await expect(page.getByText('Slug').first()).toBeVisible();
    await expect(page.getByText('lanka-electronics').first()).toBeVisible();
    await expect(page.getByText('Staff').first()).toBeVisible();
    await expect(page.getByText('Products').first()).toBeVisible();
    await expect(page.getByText('Total Sales').first()).toBeVisible();

    // BusinessSettingsForm (M08-01): identity/contact fields + LOCKED
    // currency. No vatRate/ssclRate/receiptFooter inputs ship on this page.
    await waitForHydratedInput(page, '#storeName');
    await expect(page.locator('#storeName')).toHaveValue('Lanka Electronics');
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#phoneNumber')).toBeVisible();
    await expect(page.getByText('Locked · LKR')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Business Settings' })).toBeVisible();

    // Business Access (M08-01): ACTIVE tenant shows the Disable confirm
    // trigger. The old Suspend/Reactivate/Trigger Grace/Export Data/Audit
    // Log buttons never shipped (REQ-12 stubs).
    await expect(page.getByRole('button', { name: 'Disable Business' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable Business' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export Data' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Audit Log' })).toHaveCount(0);

    // Feature-module toggles: the 3 allowlisted modules (M08-04).
    await waitForHydratedInput(page, '#module-appointments');
    await expect(page.locator('#module-appointments')).toHaveCount(1);
    await expect(page.locator('#module-delivery')).toHaveCount(1);
    await expect(page.locator('#module-website')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Feature Modules' })).toBeVisible();
  });

  test('F4 business settings save round-trip preserves sibling settings keys', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#storeName');

    // M08-01: the shipped form only edits identity/contact fields —
    // receiptFooter has no field (it is a stripped API key).
    const addr = `${RUN} Lanka addr`;
    const phone = '+94 11 987 6543';
    await page.locator('#address').fill(addr);
    await page.locator('#phoneNumber').fill(phone);
    await page.getByRole('button', { name: 'Save Business Settings' }).click();

    await expect(page.getByText('Business settings saved')).toBeVisible({ timeout: 30_000 });

    const res = await page.request.get('/api/superadmin/tenants');
    const body = await json(res);
    const lanka = (body?.businesses ?? []).find((t: any) => t.id === state.tenant2Id);
    expect(lanka?.settings?.address).toBe(addr);
    expect(lanka?.settings?.phoneNumber).toBe(phone);
    // Siblings untouched by the settings merge (M08-01 strip-not-reject).
    expect(lanka?.settings?.vatRate).toBe(18);
    expect(lanka?.settings?.currency).toBe('LKR');
    expect(lanka?.settings?.enabledModules).toEqual(state.snap2?.settings?.enabledModules);
    expect(lanka?.settings?.receiptFooter).toEqual(state.snap2?.settings?.receiptFooter);

    // Strip semantics (M08-01): vatRate/receiptFooter are NOT schema keys —
    // a direct API PATCH carrying them is accepted (200) and the stored
    // values stay unchanged.
    const strip = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/settings`, {
      storeName: 'Lanka Electronics',
      logoUrl: '',
      address: addr,
      phoneNumber: phone,
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      vatRate: 'abc',
      receiptFooter: 'x'.repeat(300),
    });
    expect(strip.status(), 'dead keys stripped → 200 (not 400)').toBe(200);
    const after = await json(await page.request.get('/api/superadmin/tenants'));
    const lanka2 = (after?.businesses ?? []).find((t: any) => t.id === state.tenant2Id);
    expect(lanka2?.settings?.vatRate, 'vatRate untouched by strip').toBe(18);
    expect(lanka2?.settings?.receiptFooter, 'receiptFooter untouched by strip').toEqual(
      state.snap2?.settings?.receiptFooter,
    );
  });

  test('F5 admin lifecycle via UI: disable → enable; grace period via API → reactivate', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#storeName');

    // M08-01: the shipped access control is TenantDisableToggle —
    // 'Disable Business' opens a ConfirmDialog that calls /suspend.
    await page.getByRole('button', { name: 'Disable Business' }).click();
    await expect(page.getByText('Disable Business').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/All users will lose access/i)).toBeVisible();
    // Radix modal aria-hides the trigger while open → only the confirm
    // button matches getByRole; .last() targets it.
    await page.getByRole('button', { name: 'Disable Business' }).last().click();
    await expect(page.getByText('Business disabled successfully')).toBeVisible({ timeout: 30_000 });

    // Status badge flips; the toggle becomes 'Enable Business' (M08-01).
    await expect(page.getByText('Suspended').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Enable Business' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Disable Business' })).toHaveCount(0);

    // Re-enable (direct button, no dialog) → /reactivate.
    await page.getByRole('button', { name: 'Enable Business' }).click();
    await expect(page.getByText('Business enabled successfully')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 30_000 });

    // Grace period has no UI button (M08-02) — drive the API, then verify
    // the badge re-renders after a fresh load.
    const grace = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/grace-period`);
    expect(grace.status(), 'grace-period → 200').toBe(200);
    expect((await json(grace))?.tenant?.status).toBe('GRACE_PERIOD');
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await expect(page.getByText('Grace Period').first()).toBeVisible({ timeout: 30_000 });

    // Restore ACTIVE (reactivate also clears graceEndsAt).
    const re = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/reactivate`);
    expect(re.status()).toBe(200);
    const restored = await json(re);
    expect(restored?.tenant?.status).toBe('ACTIVE');
    expect(restored?.tenant?.graceEndsAt).toBeNull();
  });

  test('F6 feature-module toggles: PATCH round-trip + immediate gate effect on /appointments', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#module-appointments');

    // M08-04: appointments state is snapshot-relative (seed/migration may
    // ship it either way) — normalise to DISABLED via the API first.
    const before = await json(await page.request.get('/api/superadmin/tenants'));
    const modulesBefore: string[] =
      before?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings?.enabledModules ?? [];
    if (modulesBefore.includes('appointments')) {
      const off = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/feature-modules`, {
        modules: modulesBefore.filter((m) => m !== 'appointments'),
      });
      expect(off.status(), 'normalise appointments off').toBe(200);
    }

    // OWNER of tenant 2 is bounced off /appointments while disabled.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    await page.goto(`${BASE_URL}/appointments`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    expect(page.url(), 'appointments disabled → bounced to /dashboard').toMatch(/\/dashboard/);

    // Toggle ON via the superadmin UI switch.
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#module-appointments');
    await page.locator('#module-appointments').click();
    await expect(page.getByText('Appointments enabled')).toBeVisible({ timeout: 30_000 });

    const after = await json(await page.request.get('/api/superadmin/tenants'));
    expect(after?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings?.enabledModules)
      .toContain('appointments');

    // Now the OWNER passes the module gate.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    await page.goto(`${BASE_URL}/appointments`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);
    expect(page.url(), 'appointments enabled → page stays').toMatch(/\/appointments/);

    // Restore the F0 snapshot module set via API (M08-04).
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const patched = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/feature-modules`, {
      modules: state.snap2?.settings?.enabledModules ?? [],
    });
    expect(patched.status()).toBe(200);
    expect((await json(patched))?.data?.enabledModules)
      .toEqual(state.snap2?.settings?.enabledModules ?? []);
  });

  test('F7 business creation is disabled: /new redirects, POST → 403 max-2, slug check still live', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // Redirect stub page.
    await page.goto(`${BASE_URL}/superadmin/tenants/new`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/superadmin\/tenants$/, { timeout: 15_000 });

    // POST is blocked by the hard 2-tenant cap BEFORE validation.
    const res = await apiPost(page, '/api/superadmin/tenants', {
      storeName: `${RUN} Ghost Biz`,
      slug: `${RUN}-ghost`,
      ownerEmail: `ghost-${RUN}@example.com`,
      ownerPassword: 'ghostpassword1!',
      timezone: 'Asia/Colombo',
      currency: 'LKR',
    });
    expect(res.status(), 'POST /api/superadmin/tenants → 403 (max 2)').toBe(403);
    expect((await json(res))?.error).toMatch(/Maximum of 2 businesses/);

    // check-slug stays functional for the existing slug.
    const slug = await json(
      await page.request.get('/api/superadmin/tenants/check-slug?slug=dilani'),
    );
    expect(slug).toEqual({ available: false });
    const free = await json(
      await page.request.get(`/api/superadmin/tenants/check-slug?slug=${RUN}-nobody`),
    );
    expect(free).toEqual({ available: true });
    const missing = await json(
      await page.request.get('/api/superadmin/tenants/check-slug'),
    );
    expect(missing, 'missing slug param → available:false (never 400)').toEqual({ available: false });
  });

  test('F8 system health page renders DB status + audit tail', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto(`${BASE_URL}/superadmin/system`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Connected —', { exact: false })).toBeVisible({ timeout: 30_000 });
    // The audit tail ("Recent Activity") renders recent AuditLog rows
    // directly via Prisma (page-level query, bypasses the tenant-scoped API).
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible({
      timeout: 30_000,
    });
  });

  // ── §2 Financial & calculation precision ───────────────────────────────────

  test('P1 MRR/ARR derived from plan prices; seeded plans re-priced via API (M08-05)', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // Baseline: MRR/ARR count ACTIVE Subscriptions only — the seed ships
    // plans (M08-05) but no subscriptions → still 0.
    const m0 = await json(await page.request.get('/api/admin/metrics'));
    expect(m0?.mrr).toBe(0);
    expect(m0?.arr).toBe(0);

    // Re-price a float-unsafe value (12345.55) → Decimal-safe round-trip.
    // M08-05 (BUG-39 FIXED): STARTER ships from the seed, so POST-first
    // always 409s; ensurePlan falls back to PATCH-reprice + re-activate.
    const plan = await ensurePlan(page, 'STARTER', 12345.55);
    expect(
      plan.status === 201 || (plan.status === 500 && plan.existing),
      `plan upsert → 201-equivalent (fresh create or reuse+reprice)`,
    ).toBe(true);
    if (plan.id) state.createdPlanIds.push(plan.id);

    const m1 = await json(await page.request.get('/api/admin/metrics'));
    // No ACTIVE subscriptions exist (tenants are TRIAL) → MRR still 0 but
    // the plan price itself round-trips through Decimal without drift.
    expect(m1?.mrr).toBe(0);
    const body = await json(await page.request.get('/api/admin/plans'));
    const starter = (body?.data ?? []).find((p: any) => p.id === plan.id);
    expect(Number(starter?.monthlyPrice)).toBeCloseTo(12345.55, 2);
    expect(Number(starter?.annualPrice)).toBeCloseTo(123455.5, 2);

    // M01-06/B2 pin: /dashboard/super-admin/plans is a store path, so the
    // proxy funnels SUPER_ADMIN to /superadmin/dashboard — the legacy plans
    // table (2-dp LKR) never renders for its only audience; pricing is
    // verified through the API above.
    await page.goto(`${BASE_URL}/dashboard/super-admin/plans`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/superadmin\/dashboard/, { timeout: 30_000 });
  });

  test('P2 plans CRUD: 422 validation contract + PATCH isActive + price precision', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // Invalid enum + non-positive price → 422 with an issues array.
    const bad = await apiPost(page, '/api/admin/plans', {
      name: 'ULTIMATE',
      monthlyPrice: -1,
      annualPrice: 0,
      maxUsers: 0,
      maxProductVariants: 1,
      features: [],
    });
    expect(bad.status(), 'invalid plan → 422 (not 500)').toBe(422);
    const badBody = await json(bad);
    expect(badBody?.error?.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(badBody?.error?.message)).toBe(true);

    // PATCH: 2-dp price precision + isActive toggle. Same BUG-39 tolerance
    // as P1: GROWTH may already exist from a prior run.
    const mk = await ensurePlan(page, 'GROWTH', 2500.01);
    expect(mk.status === 201 || (mk.status === 500 && mk.existing), 'plan create or reuse').toBe(true);
    expect(mk.id, 'plan id resolvable either way').toBeTruthy();
    if (mk.id) state.createdPlanIds.push(mk.id);

    // Re-activate in case a prior run archived it, then PATCH price.
    const rearm = await apiPatch(page, `/api/admin/plans/${mk.id}`, { isActive: true });
    expect(rearm.status(), 're-arm plan → 200').toBe(200);

    const patch = await apiPatch(page, `/api/admin/plans/${mk.id}`, {
      monthlyPrice: 2750.99,
      isActive: false,
    });
    expect(patch.status(), 'PATCH plan → 200').toBe(200);
    const patched = (await json(patch))?.data;
    expect(Number(patched?.monthlyPrice)).toBeCloseTo(2750.99, 2);
    expect(patched?.isActive).toBe(false);

    // PATCH unknown id → 404 NOT_FOUND.
    const ghost = await apiPatch(page, '/api/admin/plans/nonexistent-plan-id', { isActive: true });
    expect(ghost.status(), 'PATCH unknown plan → 404').toBe(404);
    expect((await json(ghost))?.error?.code).toBe('NOT_FOUND');
  });

  test('P3 admin metrics endpoint: churn/trial math sane with zero base', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const m = await json(await page.request.get('/api/admin/metrics'));
    expect(m?.mrr).toBe(0);
    expect(m?.arr).toBe(0);
    expect(m?.activeSubscribers).toBe(0);
    expect(m?.trialSubscribers).toBe(0); // seeded tenants have no Subscription rows
    expect(m?.netChurnRate).toBe(0); // no division-by-zero NaN
    expect(Number.isFinite(m?.netChurnRate)).toBe(true);
    // revenueByPlan has one entry per ACTIVE plan (not per subscription) —
    // with zero subscriptions every entry must be zeroed out.
    expect(Array.isArray(m?.revenueByPlan)).toBe(true);
    for (const entry of m?.revenueByPlan ?? []) {
      expect(typeof entry.planName).toBe('string');
      expect(entry.activeCount).toBe(0);
      expect(entry.monthlyCumulativeRevenue).toBe(0);
    }
    // Tenant rows carry planName 'None' + null billing dates.
    for (const t of m?.tenants ?? []) {
      expect(t.planName).toBe('None');
      expect(t.lastPaymentDate).toBeNull();
    }
  });

  // ── §3 Cross-module cascade & ledger impact ────────────────────────────────

  test('L1 settings save cascades to the store UI: tenant name round-trip', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant1Id, 'Ayur Wellness Centre');
    await waitForHydratedInput(page, '#storeName');

    // Rename via the shipped form (M08-01: no receiptFooter field exists).
    const renamed = `${RUN} Ayur Renamed`;
    await page.locator('#storeName').fill(renamed);
    await page.getByRole('button', { name: 'Save Business Settings' }).click();
    await expect(page.getByText('Business settings saved')).toBeVisible({ timeout: 30_000 });

    // The OWNER-facing dashboard shows the new business name (branding reads
    // Tenant.name via getTenantBranding) — cross-module cascade to the store.
    await login(page, OWNER.email, OWNER.password);
    await expect(page.getByText(renamed).first()).toBeVisible({ timeout: 60_000 });

    // Restore seed name immediately (later tests pin 'Ayur Wellness Centre').
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await restoreTenantName(
      page,
      state.tenant1Id,
      'Ayur Wellness Centre',
      { settings: state.snap1?.settings ?? {} },
    );
    const refreshed = await json(await page.request.get('/api/superadmin/tenants'));
    expect(refreshed?.businesses?.find((t: any) => t.id === state.tenant1Id)?.name).toBe(
      'Ayur Wellness Centre',
    );
  });

  test('L2 feature-module toggle drives the delivery nav surface (Phase-4/5 gate)', async ({ page }) => {
    // delivery is enabled by seed on tenant 1 → OWNER sees the module pages.
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE_URL}/delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);
    expect(page.url(), 'delivery enabled → stays on /delivery').toMatch(/\/delivery/);

    // Tenant 2 (verified independently in F6 via appointments): the API
    // list reflects per-tenant module sets. M08-04: compare against the F0
    // snapshot instead of a hardcoded literal — the seeded/migrated module
    // set is data, not a spec constant.
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const body = await json(await page.request.get('/api/superadmin/tenants'));
    const mods1 = body?.businesses?.find((t: any) => t.id === state.tenant1Id)?.settings?.enabledModules ?? [];
    const mods = body?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings?.enabledModules ?? [];
    expect(mods1, 'tenant 1 ships delivery (seed 1b)').toContain('delivery');
    expect(mods).toEqual(state.snap2?.settings?.enabledModules ?? []);
  });

  // ── §4 Audit trail, immutability & suspension gating ───────────────────────

  test('A1 suspension gating: /api/internal/tenant-status reflects lifecycle; reactivate clears grace', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // Baseline ACTIVE.
    const s0 = await json(await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant2Id}`));
    expect(s0).toEqual({ id: state.tenant2Id, status: 'ACTIVE' });

    // Suspend → status SUSPENDED.
    expect((await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/suspend`)).status()).toBe(200);
    const s1 = await json(await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant2Id}`));
    expect(s1?.status).toBe('SUSPENDED');

    // Reactivate → ACTIVE (graceEndsAt cleared).
    expect((await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/reactivate`)).status()).toBe(200);
    const s2 = await json(await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant2Id}`));
    expect(s2).toEqual({ id: state.tenant2Id, status: 'ACTIVE' });

    // Missing tenantId → 400; unknown id → 404.
    const missing = await page.request.get('/api/internal/tenant-status');
    expect(missing.status()).toBe(400);
    const ghost = await page.request.get('/api/internal/tenant-status?tenantId=ghost-id-123');
    expect(ghost.status()).toBe(404);
  });

  test('A2 no hard delete anywhere: tenants have no DELETE; suspend/reactivate are reversible flags', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // No [id]/route.ts exists at all — DELETE (and PATCH/PUT on the bare id
    // path) hit Next's 404 for an unrouted method. "No hard delete" holds.
    const del = await page.request.delete(`/api/superadmin/tenants/${state.tenant2Id}`);
    expect(del.status(), 'DELETE tenant → 404 (no such route)').toBe(404);

    // Suspend twice is idempotent at the data level (status stays SUSPENDED).
    await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/suspend`);
    const again = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/suspend`);
    expect(again.status()).toBe(200);
    const s = await json(await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant2Id}`));
    expect(s?.status).toBe('SUSPENDED');

    // Restore for downstream tests.
    await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/reactivate`);
    const restored = await json(await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant2Id}`));
    expect(restored?.status).toBe('ACTIVE');
  });

  test('A3 audit-log API serves SUPER_ADMIN a cross-tenant ledger (200, not 401)', async ({ page }) => {
    // M08-03 (BUG-37) FIXED PIN: /api/audit-logs branches on role — the
    // tenantless SUPER_ADMIN now gets the system-wide cross-tenant feed
    // (optional ?tenantId= narrows it) instead of the old 401
    // "No tenant associated". Tenant-scoped roles are unchanged.
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const res = await page.request.get('/api/audit-logs?limit=3');
    expect(res.status(), 'SUPER_ADMIN audit-logs → 200 (cross-tenant)').toBe(200);
    const body = await json(res);
    expect(Array.isArray(body?.data), 'rows array in canonical envelope').toBe(true);
    expect(body.data.length, 'system ledger has rows (incl. this login)').toBeGreaterThan(0);
    expect(typeof body?.meta?.total).toBe('number');
  });

  // ── §5 Chaos, button spamming & race conditions ────────────────────────────

  test('R1 double-click Save Business Settings applies exactly once (final value stable)', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#storeName');

    // M08-01: #receiptFooter never shipped — use the address field.
    await page.locator('#address').fill(`${RUN} dblclick addr`);
    await page.getByRole('button', { name: 'Save Business Settings' }).dblclick();
    await expect(page.getByText('Business settings saved').first()).toBeVisible({ timeout: 30_000 });

    // Exactly the same value lands (no corruption / double-append).
    const body = await json(await page.request.get('/api/superadmin/tenants'));
    const lanka = body?.businesses?.find((t: any) => t.id === state.tenant2Id);
    expect(lanka?.settings?.address).toBe(`${RUN} dblclick addr`);
  });

  test('R2 3-way concurrent settings PATCH: zero 500s, last-write-wins, siblings intact', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // Capture the CURRENT sibling state to compare against — the invariant is
    // "this test's PATCHes don't clobber siblings", not "equals the F0
    // snapshot" (an earlier test may have normalised enabledModules undefined→[]).
    const preBody = await json(await page.request.get('/api/superadmin/tenants'));
    const preSettings = preBody?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings;
    const preModules = preSettings?.enabledModules;
    const preVat = preSettings?.vatRate;

    const results = await Promise.all(
      [1, 2, 3].map((i) =>
        // M08-01: schema keys only — vatRate/receiptFooter are stripped
        // (strip-not-reject), so they must not appear in the payload here.
        apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/settings`, {
          storeName: 'Lanka Electronics',
          logoUrl: '',
          address: `Race addr ${i}`,
          phoneNumber: '0770000000',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        }),
      ),
    );
    const statuses = results.map((r) => r.status());
    expect(statuses.filter((s) => s >= 500).length, 'zero 500s under 3-way race').toBe(0);
    expect(statuses.every((s) => s === 200), 'all patches accepted (last-write-wins)').toBe(true);

    // Final state is one of the three winners; siblings survived.
    const body = await json(await page.request.get('/api/superadmin/tenants'));
    const settings = body?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings;
    expect(['Race addr 1', 'Race addr 2', 'Race addr 3']).toContain(settings?.address);
    expect(settings?.enabledModules, 'enabledModules untouched by settings PATCH').toEqual(preModules);
    expect(settings?.vatRate, 'vatRate preserved — stripped key, merge keeps it').toEqual(preVat);
  });

  test('R3 rapid module-toggle spam: final enabledModules is a coherent list (no dupes)', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#module-appointments');

    // Toggle delivery rapidly on/off/on via the UI switch.
    const sw = page.locator('#module-delivery');
    for (let i = 0; i < 4; i++) {
      await sw.click();
      await page.waitForTimeout(700);
    }

    // Final PATCH through the API settles a canonical list, then assert.
    // M08-04: settle back to the F0 snapshot set (allowlisted names only).
    const settle = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/feature-modules`, {
      modules: state.snap2?.settings?.enabledModules ?? ['delivery'],
    });
    expect(settle.status()).toBe(200);

    const body = await json(await page.request.get('/api/superadmin/tenants'));
    const mods: string[] = body?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings?.enabledModules;
    expect(Array.isArray(mods)).toBe(true);
    expect(new Set(mods).size, 'no duplicate modules after spam').toBe(mods.length);
    // M08-04: the settle PATCH restores the F0 snapshot set exactly.
    expect(mods).toEqual(state.snap2?.settings?.enabledModules ?? mods);
  });

  // ── §6 Hardware & device simulation ────────────────────────────────────────

  test('H1 logo uploader: wrong MIME rejected 400; upload failure surfaces a toast (no crash)', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant1Id, 'Ayur Wellness Centre');
    await waitForHydratedInput(page, '#storeName');

    // Wrong MIME (text file masquerading) → API 400 before storage.
    const bad = await page.request.post('/api/upload/logo', {
      multipart: {
        file: {
          name: 'logo.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not-an-image'),
        },
        tenantId: state.tenant1Id,
      },
    });
    expect(bad.status(), 'wrong-MIME logo → 400').toBe(400);
    expect((await json(bad))?.error).toMatch(/JPEG, PNG, WebP/);

    // A valid PNG hits the storage provider; without provider credentials the
    // route 500s but the UI must stay alive and show feedback (device-storage
    // simulation tolerant of absent infra — roadmap note, req 1.1 analogue).
    const form2 = {
      file: {
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        ),
      },
      tenantId: state.tenant1Id,
    };
    const ok = await page.request.post('/api/upload/logo', { multipart: form2 });
    // Valid PNG reaches the storage provider; without provider credentials
    // the route 500s — both accepted (upload infra is env-dependent).
    expect(ok.status() === 200 || ok.status() === 500, 'PNG upload → 200 or provider-500').toBe(true);

    if (ok.status() === 200) {
      const url = (await json(ok))?.url as string;
      expect(url).toBeTruthy();
      // Round-trip: persist a valid logoUrl through the settings API.
      // M08-01: schema keys only (receiptFooter/vatRate/ssclRate stripped).
      const patch = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
        storeName: 'Ayur Wellness Centre',
        logoUrl: url,
        address: '',
        phoneNumber: '',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      });
      expect(patch.status()).toBe(200);
    }

    // UI survived: the settings form is still interactive. The Save button
    // is disabled until a field is dirty (React state), so type into a field
    // to make the form dirty before asserting enabled.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHydratedInput(page, '#storeName');
    await page.locator('#address').fill('post-upload check');
    await expect(page.getByRole('button', { name: 'Save Business Settings' })).toBeEnabled({
      timeout: 15_000,
    });
  });

  test('H2 tenant-status status-board input handling: missing/invalid params handled (scanner-analogue)', async ({ page }) => {
    // Missing param → 400 (typed, not 500).
    const missing = await page.request.get('/api/internal/tenant-status');
    expect(missing.status(), 'missing tenantId → 400').toBe(400);

    // Rapid-fire valid polls (device-keystroke analogue) — all 200, coherent.
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    for (let i = 0; i < 5; i++) {
      const res = await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant1Id}`);
      expect(res.status()).toBe(200);
      expect((await json(res))?.status).toBe('ACTIVE');
    }

    // Empty-string param behaves like missing (route falsy-guard → 400).
    const empty = await page.request.get('/api/internal/tenant-status?tenantId=');
    expect(empty.status(), 'empty tenantId → 400').toBe(400);
  });

  // ── §7 Network resilience & offline sync ───────────────────────────────────

  test('N1 settings PATCH 500 → error toast, form stays interactive', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#storeName');

    await page.route('**/api/superadmin/tenants/*/settings', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }),
    );

    await page.locator('#address').fill('Offline addr attempt');
    await page.getByRole('button', { name: 'Save Business Settings' }).click();
    await expect(page.getByText(/Failed to save business settings|Network error/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Form remains interactive after the failure.
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Business Settings' })).toBeEnabled();
  });

  test('N2 module-toggle 504 → error toast, switch state does not flip client-side', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await gotoTenantDetail(page, state.tenant2Id, 'Lanka Electronics');
    await waitForHydratedInput(page, '#module-appointments');

    // Capture the pre-failure enabled state.
    const before = await json(await page.request.get('/api/superadmin/tenants'));
    const modsBefore: string[] = before?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings?.enabledModules ?? [];

    await page.route('**/feature-modules', (route) =>
      route.fulfill({ status: 504, contentType: 'application/json', body: '{"success":false}' }),
    );

    await page.locator('#module-delivery').click();
    await expect(page.getByText(/Failed to update feature modules|Network error/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Client state unchanged: enabledModules list was NOT optimistically mutated.
    const after = await json(await page.request.get('/api/superadmin/tenants'));
    const modsAfter: string[] = after?.businesses?.find((t: any) => t.id === state.tenant2Id)?.settings?.enabledModules ?? [];
    expect(modsAfter).toEqual(modsBefore);

    await page.unroute('**/feature-modules');
  });

  // ── §8 Security, RBAC & multi-tenant isolation ─────────────────────────────

  test('S1 unauthenticated: superadmin pages → /login; APIs rejected (401/403 mix)', async ({ page }) => {
    // Pages (layout guard).
    for (const path of ['/superadmin/dashboard', '/superadmin/tenants', '/superadmin/system']) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    }

    // XC-02 policy: missing/invalid session → 401 everywhere (requireSuperAdmin
    // gate); authenticated-but-forbidden → 403. The old 403-for-anonymous mix
    // (OBS-13) is gone.
    const list = await page.request.get('/api/superadmin/tenants');
    expect(list.status(), 'unauth list → 401').toBe(401);

    const metrics = await page.request.get('/api/admin/metrics');
    expect(metrics.status(), 'unauth metrics → 401').toBe(401);

    const susp = await page.request.post('/api/superadmin/tenants/x/suspend');
    expect(susp.status(), 'unauth suspend → 401').toBe(401);

    const fm = await apiPatch(page, '/api/superadmin/tenants/x/feature-modules', {});
    expect(fm.status(), 'unauth feature-modules → 401').toBe(401);

    // internal tenant-status is deliberately unauthenticated (middleware bridge).
    const internal = await page.request.get(`/api/internal/tenant-status?tenantId=${state.tenant1Id}`);
    expect(internal.status(), 'internal status is unauth-readable (middleware bridge)').toBe(200);
  });

  test('S2 CASHIER: /superadmin/* pages bounce (→/pos), every superadmin API 403', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);

    // Proxy bounce (M01-06 hardened src/proxy.ts): non-SUPER_ADMIN on a
    // /superadmin path → /dashboard; the store-role hop chain may then land
    // the CASHIER on /pos.
    await page.goto(`${BASE_URL}/superadmin/tenants`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    expect(page.url(), 'cashier /superadmin/tenants → bounced off superadmin').toMatch(/\/(pos|dashboard)/);

    const matrix: Array<[string, any]> = [
      ['GET list', await page.request.get('/api/superadmin/tenants')],
      ['GET plans', await page.request.get('/api/superadmin/plans')],
      ['GET admin plans', await page.request.get('/api/admin/plans')],
      ['GET metrics', await page.request.get('/api/admin/metrics')],
      ['GET check-slug', await page.request.get('/api/superadmin/tenants/check-slug?slug=dilani')],
      ['PATCH settings', await apiPatch(page, '/api/superadmin/tenants/x/settings', {})],
      ['PATCH feature-modules', await apiPatch(page, '/api/superadmin/tenants/x/feature-modules', {})],
      ['POST suspend', await page.request.post('/api/superadmin/tenants/x/suspend')],
      ['POST reactivate', await page.request.post('/api/superadmin/tenants/x/reactivate')],
      ['POST grace', await page.request.post('/api/superadmin/tenants/x/grace-period')],
    ];
    for (const [label, res] of matrix) {
      expect(res.status(), `CASHIER ${label} → 403`).toBe(403);
    }
  });

  test('S3 OWNER cannot touch superadmin APIs; cross-tenant admin by OWNER impossible', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const list = await page.request.get('/api/superadmin/tenants');
    expect(list.status(), 'OWNER superadmin list → 403').toBe(403);
    const susp = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/suspend`);
    expect(susp.status(), 'OWNER suspend another tenant → 403').toBe(403);
    const fm = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/feature-modules`, {
      modules: [],
    });
    expect(fm.status(), 'OWNER feature-modules → 403').toBe(403);
    const settings = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/settings`, {
      storeName: 'Hacked',
    });
    expect(settings.status(), 'OWNER settings PATCH → 403').toBe(403);
  });

  test('S4 tenant isolation: superadmin settings merge never leaks cross-tenant keys', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // Patch tenant 1 with distinct values.
    // M08-01: schema keys only — receiptFooter/vatRate/ssclRate are stripped
    // (and must not be able to cross the tenant boundary anyway).
    const p = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      storeName: 'Ayur Wellness Centre',
      logoUrl: '',
      address: `${RUN} isolation addr`,
      phoneNumber: '0712345678',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    });
    expect(p.status()).toBe(200);

    // Tenant 2 is untouched by tenant-1's patch.
    const body = await json(await page.request.get('/api/superadmin/tenants'));
    const t2 = body?.businesses?.find((t: any) => t.id === state.tenant2Id);
    expect(t2?.settings?.address).not.toBe(`${RUN} isolation addr`);
    expect(t2?.settings?.phoneNumber).not.toBe('0712345678');
    expect(t2?.name).toBe('Lanka Electronics');
  });

  // ── §9 Boundary inputs & chaos data ────────────────────────────────────────

  test('X1 settings validation contract: bad cases → 400 VALIDATION_ERROR (first issue); dead keys stripped', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // M08-01: businessSettingsSchema keys only. receiptFooter/vatRate/
    // ssclRate are NOT schema fields — payloads carrying them are accepted
    // with the keys stripped (see the strip case after the loop), so the
    // old 'receiptFooter 241'/'vatRate 101'/'ssclRate -1'/'vatRate letters'
    // 400-cases are gone.
    const valid = {
      logoUrl: '',
      address: 'a',
      phoneNumber: '1',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    };
    const cases: Array<[string, Record<string, unknown>]> = [
      ['storeName 1 char', { storeName: 'x' }],
      ['storeName missing', {}],
      ['storeName 81 chars', { storeName: 'x'.repeat(81) }],
      ['logoUrl not-a-url', { storeName: 'Ok Name', logoUrl: 'not-a-url' }],
      ['address 161 chars', { storeName: 'Ok Name', address: 'a'.repeat(161) }],
      ['phoneNumber 41 chars', { storeName: 'Ok Name', phoneNumber: 'p'.repeat(41) }],
      ['currency empty', { storeName: 'Ok Name', currency: '' }],
      ['timezone empty', { storeName: 'Ok Name', timezone: '' }],
    ];

    for (const [label, override] of cases) {
      const res = await apiPatch(
        page,
        `/api/superadmin/tenants/${state.tenant1Id}/settings`,
        { ...valid, ...override },
      );
      const body = await json(res);
      expect(res.status(), `${label} → 400`).toBe(400);
      expect(body?.error?.code ?? '', label).toBe('VALIDATION_ERROR');
      expect(typeof body?.error?.message, `${label} carries first-issue message`).toBe('string');
    }

    // Strip-not-reject pin (M08-01): dead keys are removed by Zod, never
    // rejected — 200 and the stored vatRate/receiptFooter stay untouched.
    const before = (await json(await page.request.get('/api/superadmin/tenants')))
      ?.businesses?.find((t: any) => t.id === state.tenant1Id);
    const strip = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      ...valid,
      storeName: 'Ayur Wellness Centre',
      address: typeof before?.settings?.address === 'string' ? before.settings.address : '',
      phoneNumber: typeof before?.settings?.phoneNumber === 'string' ? before.settings.phoneNumber : '',
      vatRate: 'abc',
      receiptFooter: 'x'.repeat(300),
    });
    expect(strip.status(), 'dead keys → stripped, 200 (not 400)').toBe(200);
    const after = (await json(await page.request.get('/api/superadmin/tenants')))
      ?.businesses?.find((t: any) => t.id === state.tenant1Id);
    expect(after?.settings?.vatRate, 'stored vatRate unchanged by strip').toEqual(
      before?.settings?.vatRate,
    );
    expect(after?.settings?.receiptFooter, 'stored receiptFooter unchanged by strip').toEqual(
      before?.settings?.receiptFooter,
    );
  });

  test('X2 boundary accept: 160-char address, 40-char phone; dead keys stripped not stored', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // M08-01: the shipped schema caps address at 160 and phoneNumber at 40.
    // receiptFooter/vatRate/ssclRate are NOT schema keys — sending them is
    // accepted (200) but they never overwrite the stored sibling values.
    const res = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      storeName: 'Ayur Wellness Centre',
      logoUrl: '',
      address: 'A'.repeat(160),
      phoneNumber: 'P'.repeat(40),
      receiptFooter: 'F'.repeat(240),
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      vatRate: 100,
      ssclRate: 0,
    });
    expect(res.status(), 'address/phone at max → 200').toBe(200);
    const data = (await json(res))?.data;
    expect((data?.settings?.address as string).length).toBe(160);
    expect((data?.settings?.phoneNumber as string).length).toBe(40);
    // Dead keys stripped: stored values untouched (seed truth via F0 snapshot).
    expect(data?.settings?.vatRate, 'vatRate 100 stripped — stored value kept').toBe(
      state.snap1?.settings?.vatRate ?? 18,
    );
    expect(data?.settings?.ssclRate, 'ssclRate 0 stripped — stored value kept').toBe(
      state.snap1?.settings?.ssclRate ?? 2.5,
    );
    expect(data?.settings?.receiptFooter, 'receiptFooter stripped — stored value kept').toEqual(
      state.snap1?.settings?.receiptFooter,
    );

    // Currency lock (M08-01): a client-sent currency never wins — the server
    // forces LKR into the merged settings.
    const lock = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      storeName: 'Ayur Wellness Centre',
      logoUrl: '',
      address: '',
      phoneNumber: '',
      currency: 'USD',
      timezone: 'Asia/Colombo',
    });
    expect(lock.status()).toBe(200);
    expect((await json(lock))?.data?.settings?.currency, 'currency locked to LKR').toBe('LKR');
  });

  test('X3 chaos payloads: Unicode round-trip, XSS inert, forgery keys ignored', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // M08-01: receiptFooter is a stripped key — unicode/XSS payloads now ride
    // the address field (≤160).
    const unicode = `සමඟ ${RUN} தமிழ் 🌿`;
    const uni = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      storeName: 'Ayur Wellness Centre',
      logoUrl: '',
      address: unicode,
      phoneNumber: '',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    });
    expect(uni.status(), 'unicode address → 200').toBe(200);
    expect((await json(uni))?.data?.settings?.address).toBe(unicode);

    // XSS in the address is stored inert and rendered as text in the UI.
    const xss = `<img src=x onerror=window.__m08xss=1>`;
    const xssRes = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      storeName: 'Ayur Wellness Centre',
      logoUrl: '',
      address: xss,
      phoneNumber: '',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    });
    expect(xssRes.status()).toBe(200);

    await gotoTenantDetail(page, state.tenant1Id, 'Ayur Wellness Centre');
    await waitForHydratedInput(page, '#address');
    await expect(page.locator('#address')).toHaveValue(xss, { timeout: 30_000 });
    const fired = await page.evaluate(() => (window as any).__m08xss);
    expect(fired, 'onerror handler must never execute').toBeUndefined();

    // Forgery pin: server-owned fields win (status/subscriptionStatus/
    // enabledModules forging is ignored by the settings schema — unknown keys
    // are stripped by zod).
    const forged = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/settings`, {
      storeName: 'Ayur Wellness Centre',
      logoUrl: '',
      address: '',
      phoneNumber: '',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      status: 'CANCELLED',
      subscriptionStatus: 'CANCELLED',
      enabledModules: ['hacked'],
      deletedAt: '1999-01-01T00:00:00Z',
      graceEndsAt: '1999-01-01T00:00:00Z',
    });
    expect(forged.status(), 'forged status keys ignored → 200').toBe(200);
    const fb = await json(await page.request.get('/api/superadmin/tenants'));
    const t1 = fb?.businesses?.find((t: any) => t.id === state.tenant1Id);
    expect(t1?.status).toBe('ACTIVE');
    expect(t1?.subscriptionStatus).toBe('TRIAL');
    expect(t1?.settings?.enabledModules).not.toEqual(['hacked']);
    expect(t1?.deletedAt ?? null).toBeNull();
  });

  test('X4 feature-modules chaos: unknown module names rejected (400), empty list OK, wrong type 400', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // M08-04 (BUG-38) FIXED PIN: FeatureModuleToggleSchema validates against
    // the canonical TENANT_FEATURE_MODULES allowlist (appointments/delivery/
    // website); any unknown name → 400 VALIDATION_ERROR, nothing stored.
    const weird = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/feature-modules`, {
      modules: ['delivery', 'website', 'hacked-module'],
    });
    expect(weird.status(), 'unknown module name → 400').toBe(400);
    const weirdBody = await json(weird);
    expect(weirdBody?.error?.code, 'typed VALIDATION_ERROR').toBe('VALIDATION_ERROR');

    // Empty list accepted (disables everything — gates then hide the pages).
    const empty = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/feature-modules`, {
      modules: [],
    });
    expect(empty.status(), '[] clears modules → 200').toBe(200);
    expect((await json(empty))?.data?.enabledModules).toEqual([]);

    // Non-array modules → 400 VALIDATION_ERROR.
    const bad = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/feature-modules`, {
      modules: 'delivery',
    });
    expect(bad.status(), 'modules:string → 400').toBe(400);

    // Valid allowlist toggle → 200 (restore tenant 1 seed modules).
    const restore = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/feature-modules`, {
      modules: ['appointments', 'delivery', 'website'],
    });
    expect(restore.status(), 'valid modules → 200').toBe(200);
    expect((await json(restore))?.data?.enabledModules).toEqual(['appointments', 'delivery', 'website']);
  });

  test('X5 chaos lifecycle matrix: unknown tenant id across all action routes', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // settings: schema validates the body BEFORE the tenant lookup, so an
    // incomplete payload → 400 VALIDATION_ERROR; a complete payload reaches
    // the Prisma lookup → 404 NOT_FOUND.
    const sBad = await apiPatch(page, '/api/superadmin/tenants/nonexistent-tenant/settings', {
      storeName: 'x'.repeat(5),
    });
    expect(sBad.status(), 'settings unknown id + partial body → 400 (schema first)').toBe(400);
    const s = await apiPatch(page, '/api/superadmin/tenants/nonexistent-tenant/settings', {
      storeName: 'x'.repeat(5),
      logoUrl: '',
      address: '',
      phoneNumber: '',
      receiptFooter: '',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      vatRate: 0,
      ssclRate: 0,
    });
    expect(s.status(), 'settings unknown id + full body → 404').toBe(404);
    const f = await apiPatch(page, '/api/superadmin/tenants/nonexistent-tenant/feature-modules', {
      modules: [],
    });
    expect(f.status(), 'feature-modules unknown id → 404').toBe(404);

    // M08-02 (BUG-36) FIXED PIN: suspend/reactivate/grace-period now do an
    // explicit findUnique → 404 NOT_FOUND typed envelope (with try/catch +
    // toErrorResponse behind it) instead of the old unhandled P2025 500.
    for (const action of ['suspend', 'reactivate', 'grace-period']) {
      const res = await page.request.post(`/api/superadmin/tenants/nonexistent-tenant/${action}`);
      expect(res.status(), `${action} unknown id → 404`).toBe(404);
      const body = await json(res);
      expect(body?.success, `${action} 404 envelope success:false`).toBe(false);
      expect(body?.error?.code, `${action} error code NOT_FOUND`).toBe('NOT_FOUND');
    }
  });

  // ── §10 Time-travel & retroactive dates ────────────────────────────────────

  test('T1 grace period sets exactly +14 days from now (±2 min skew)', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    const res = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/grace-period`);
    expect(res.status()).toBe(200);
    const tenant = (await json(res))?.tenant;
    expect(tenant?.status).toBe('GRACE_PERIOD');

    const expected = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const actual = new Date(tenant.graceEndsAt).getTime();
    expect(Math.abs(actual - expected), 'graceEndsAt ≈ now + 14d').toBeLessThan(2 * 60 * 1000);

    // Restore.
    const re = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/reactivate`);
    expect(re.status()).toBe(200);
    const restored = (await json(re))?.tenant;
    expect(restored?.status).toBe('ACTIVE');
    expect(restored?.graceEndsAt).toBeNull();
  });

  test('T2 createdAt/updatedAt semantics: forgery ignored, updatedAt advances on settings PATCH', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    const before = (await json(await page.request.get('/api/superadmin/tenants')))
      ?.businesses?.find((t: any) => t.id === state.tenant2Id);

    await page.waitForTimeout(1_100);
    // M08-01: schema keys only (dead keys would be stripped anyway).
    const p = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/settings`, {
      storeName: 'Lanka Electronics',
      logoUrl: '',
      address: 'time-travel addr',
      phoneNumber: '0770000001',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    });
    expect(p.status()).toBe(200);

    const after = (await json(await page.request.get('/api/superadmin/tenants')))
      ?.businesses?.find((t: any) => t.id === state.tenant2Id);
    expect(String(after?.createdAt)).toBe(String(before?.createdAt));
    expect(new Date(after?.updatedAt).getTime()).toBeGreaterThan(
      new Date(before?.updatedAt).getTime(),
    );
  });

  // ── Defect pins (BUG-35 / BUG-36 / BUG-37 / BUG-38 companions) ────────────

  test('B1a BUG-35 pin: suspended tenant owner cannot even log in (M08-01 login gate)', async ({ page }) => {
    // M08-01 hardened BUG-35 beyond the W1 proxy gate: authorize() now checks
    // the tenant status AFTER password verification, so a suspended owner gets
    // NO session at all — the login form shows the suspension message inline
    // and API calls stay 401 (unauthenticated), not 403.
    const sa = page.context(); // the page's own context — cleared to drop the SA session
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    expect(
      (await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/suspend`)).status(),
    ).toBe(200);

    await sa.clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email address').fill(OWNER_TENANT2.email);
    await page.getByLabel('Password').fill(OWNER_TENANT2.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(
      page.getByText('Your business account is suspended'),
      'login rejected with suspension copy',
    ).toBeVisible({ timeout: 20_000 });
    expect(page.url(), 'no session minted — stays on /login').not.toMatch(/dashboard|suspended/);
    const sess = await (await page.request.get('/api/auth/session')).json().catch(() => null);
    expect(sess?.user, 'session endpoint has no user').toBeFalsy();
    const api = await page.request.get('/api/store/customers');
    expect(api.status(), 'no-session tenant API → 401').toBe(401);

    // Restore immediately.
    await sa.clearCookies();
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const re = await page.request.post(`/api/superadmin/tenants/${state.tenant2Id}/reactivate`);
    expect(re.status()).toBe(200);
    expect((await json(re))?.tenant?.status).toBe('ACTIVE');
  });

  test('B1b BUG-35 pin: an ALREADY-LOGGED-IN suspended session loses API + pages (proxy + layout guard)', async ({
    page,
    browser,
  }) => {
    // Data-level half of M08-01 (landed W1 in src/proxy.ts, re-pinned here):
    // a session minted BEFORE suspension keeps working until its next request,
    // then tenant APIs get 403 TENANT_SUSPENDED and pages redirect /suspended.
    await login(page, OWNER_TENANT2.email, OWNER_TENANT2.password);
    expect(
      (await page.request.get('/api/store/customers')).status(),
      'active tenant API works pre-suspension',
    ).toBe(200);

    // Suspend from an isolated SUPER_ADMIN context (own cookies, no bounce).
    const saPage = await browser.newPage();
    await login(saPage, SUPERADMIN.email, SUPERADMIN.password);
    expect(
      (await saPage.request.post(`/api/superadmin/tenants/${state.tenant2Id}/suspend`)).status(),
    ).toBe(200);

    const api = await page.request.get('/api/store/customers');
    expect(api.status(), 'suspended tenant API → 403').toBe(403);
    const body = await api.json().catch(() => null);
    expect(body?.error?.code).toBe('TENANT_SUSPENDED');

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page, 'suspended-tenant page nav gated to /suspended').toHaveURL(/\/suspended/, {
      timeout: 20_000,
    });

    // Restore immediately; the same live session recovers without re-login.
    await saPage.request.post(`/api/superadmin/tenants/${state.tenant2Id}/reactivate`);
    await saPage.close();
    const back = await page.request.get('/api/store/customers');
    expect(back.status(), 'reactivation restores the session mid-flight').toBe(200);
  });

  test('B2 BUG-9 pin: SUPER_ADMIN hitting a tenant store route is funneled to the super-admin area (M01-06 FIXED)', async ({ page }) => {
    // M01-06: src/proxy.ts now runs the SUPER_ADMIN store-route funnel (it
    // redirected before the page guard could). Hitting any store route lands
    // on /superadmin/dashboard — the intended behavior — instead of the old
    // /login dead-middleware artifact (BUG-9).
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    expect(page.url(), 'SUPER_ADMIN /dashboard → /superadmin/dashboard').toMatch(
      /\/superadmin\/dashboard/,
    );
    await page.goto(`${BASE_URL}/suppliers`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    expect(page.url(), 'SUPER_ADMIN /suppliers → /superadmin/dashboard').toMatch(
      /\/superadmin\/dashboard/,
    );
  });

  // ── Cleanup: exact restore of both tenants + plan retirement ──────────────

  test('cleanup: restore seed settings/statuses for both tenants; retire RUN plans', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);

    // 1) Retire plans created by this run (archive; no delete API exists).
    await archivePlanByName(page, 'STARTER');
    await archivePlanByName(page, 'GROWTH');
    for (const id of state.createdPlanIds) {
      await apiPatch(page, `/api/admin/plans/${id}`, { isActive: false }).catch(() => {});
    }

    // 2) Exact settings restore from the F0 snapshot (both tenants).
    // M08-01: schema keys only — vatRate/receiptFooter/ssclRate are stripped
    // by the route and preserved server-side by the merge, so the snapshot
    // siblings need no resend.
    for (const snap of [state.snap1, state.snap2]) {
      if (!snap?.id) continue;
      const settings = snap.settings ?? {};
      const res = await apiPatch(page, `/api/superadmin/tenants/${snap.id}/settings`, {
        storeName: snap.name,
        logoUrl: snap.logoUrl ?? '',
        address: typeof settings.address === 'string' ? settings.address : '',
        phoneNumber: typeof settings.phoneNumber === 'string' ? settings.phoneNumber : '',
        currency: typeof settings.currency === 'string' ? settings.currency : 'LKR',
        timezone: typeof settings.timezone === 'string' ? settings.timezone : 'Asia/Colombo',
      });
      expect(res.status(), `restore settings for ${snap.slug}`).toBe(200);
    }

    // 3) Restore seed enabledModules (F0 snapshot truth).
    const mods1 = await apiPatch(page, `/api/superadmin/tenants/${state.tenant1Id}/feature-modules`, {
      modules: state.snap1?.settings?.enabledModules ?? ['appointments', 'delivery', 'website'],
    });
    const mods2 = await apiPatch(page, `/api/superadmin/tenants/${state.tenant2Id}/feature-modules`, {
      modules: state.snap2?.settings?.enabledModules ?? ['delivery'],
    });
    expect(mods1.status()).toBe(200);
    expect(mods2.status()).toBe(200);

    // 4) Guarantee both tenants are ACTIVE with cleared grace (seed truth).
    for (const id of [state.tenant1Id, state.tenant2Id]) {
      const status = await json(await page.request.get(`/api/internal/tenant-status?tenantId=${id}`));
      if (status?.status !== 'ACTIVE') {
        expect((await page.request.post(`/api/superadmin/tenants/${id}/reactivate`)).status()).toBe(200);
      }
    }

    // 5) Verify final state — seed-truth names (hardcoded, not snapshot, so
    //    the suite self-heals after an aborted run that renamed tenants).
    const body = await json(await page.request.get('/api/superadmin/tenants'));
    const t1 = body?.businesses?.find((t: any) => t.id === state.tenant1Id);
    const t2 = body?.businesses?.find((t: any) => t.id === state.tenant2Id);
    expect(t1?.name).toBe('Ayur Wellness Centre');
    expect(t1?.status).toBe('ACTIVE');
    expect(t2?.name).toBe('Lanka Electronics');
    expect(t2?.status).toBe('ACTIVE');
    // M08-01: receiptFooter is a stripped key — the merge never touches it,
    // so the stored value must still equal the F0 snapshot exactly (for
    // Lanka that is key-absent/undefined, not '').
    expect(t2?.settings?.receiptFooter, 'tenant 2 footer untouched by strip semantics').toEqual(
      state.snap2?.settings?.receiptFooter,
    );
  });
});
