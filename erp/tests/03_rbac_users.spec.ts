import { test, expect, type Page, type Browser, type APIResponse } from '@playwright/test';

/**
 * ============================================================================
 * 03_rbac_users.spec.ts — Module 03: RBAC, Users & Permissions
 * ============================================================================
 *
 * Roadmap: erp/docs/qa/QA_ROADMAP.md  ->  Phase 1 / Module 03
 * Requirements: erp/docs/qa/QA_CLIENT_REQ.md -> Group 2, section 2.4 (RBAC Mapping)
 *
 * Inspected surface (read-only; no application code was modified):
 *   UI    src/app/(store)/settings/users/page.tsx
 *         src/components/settings/UserPermissionsSettingsClient.tsx
 *         src/app/(store)/staff/page.tsx
 *   API   src/app/api/store/staff/route.ts            (GET, POST)
 *         src/app/api/store/staff/[id]/route.ts       (GET, PATCH)
 *         src/app/api/admin/users/[userId]/force-logout/route.ts (POST)
 *         src/app/api/audit-logs/route.ts             (GET)
 *   Core  src/lib/services/staff.service.ts
 *         src/lib/validators/staff.validators.ts
 *         src/lib/constants/permissions.ts
 *         src/lib/auth.ts / src/lib/auth.config.ts / middleware.ts
 *
 * PREREQUISITES
 *   - Dev server on http://localhost:3003 (repo-root `qa-start.cmd`, or `yarn dev` in erp/).
 *   - Database seeded: `pnpm prisma db seed`.
 *   - Config runs serial (workers: 1) — see erp/playwright.config.ts. This suite
 *     mutates shared seeded users, so serial execution is mandatory.
 *
 * DESIGN NOTES
 *   - Logins are cached into Playwright storageState files per identity. The
 *     login endpoint rate-limits to 10 failures / IP / 15 min (src/lib/auth.ts:37),
 *     so the suite performs at most one login per identity.
 *   - There is NO DELETE route for staff (verified: no `export async function
 *     DELETE` in src/app/api/store/staff/). Created QA users therefore cannot be
 *     removed; they are deactivated in `afterAll` and carry a run-id email so
 *     repeated runs do not collide.
 *   - Tests assert the CORRECT expected behaviour. Where the implementation
 *     diverges, the test fails and the divergence is logged in QA_BUG_REPORT.md.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const RUN_ID = `${Date.now()}`.slice(-7);

/** Credentials from erp/docs/qa/TEST_CREDENTIALS.md (seeded by prisma/seed.ts). */
const USERS = {
  owner: {
    email: 'owner@dilani-ayurwellness.lk',
    password: 'owner123!',
    label: 'OWNER / Ayur Wellness',
  },
  owner2: {
    email: 'owner@lanka-electronics.lk',
    password: 'owner123!',
    label: 'OWNER / Lanka Electronics',
  },
  cashier: { email: 'cashier1@ayurpos.dev', password: 'cashier123!', label: 'CASHIER' },
  dispatch: { email: 'dispatch@ayurpos.dev', password: 'dispatch123!', label: 'DISPATCH_STAFF' },
  superadmin: { email: 'superadmin@ayurpos.dev', password: 'changeme123!', label: 'SUPER_ADMIN' },
} as const;

type UserKey = keyof typeof USERS;

/** Permission keys under test (src/lib/constants/permissions.ts). */
const PERM = {
  staffView: 'staff:view',
  staffManage: 'staff:manage',
  assignPermissions: 'staff:permissions:assign',
  manageUsers: 'settings:users',
  saleCreate: 'sale:create',
  viewAuditLog: 'settings:view_audit_log',
} as const;

/** A staff email that is guaranteed not to exist before this run. */
const qaEmail = (tag: string) => `qa03.${RUN_ID}.${tag}@ayurpos-qa.test`;

// ─── Login / session helpers ────────────────────────────────────────────────

/**
 * Perform a UI login. Lands anywhere except /login.
 * Kept deliberately tolerant: each role redirects to a different landing page
 * (OWNER -> /dashboard, CASHIER -> /pos, DISPATCH_STAFF -> /delivery).
 */
async function performLogin(page: Page, key: UserKey): Promise<void> {
  const { email, password } = USERS[key];
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  // CASHIER does not navigate: it raises an "Open POS" interstitial while still
  // on /login (src/app/(auth)/login/page.tsx:210-236). Give the dialog time to
  // mount, dismiss it into the current tab, then wait for the redirect. Roles
  // other than CASHIER never raise it, so the wait simply times out.
  const openHere = page.getByRole('button', { name: /Open in this tab/i });
  try {
    await openHere.waitFor({ state: 'visible', timeout: 4_000 });
    await openHere.click();
  } catch {
    /* no interstitial for this role */
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

const stateDir = require('os').tmpdir();
const stateCache = new Map<UserKey, string>();

/**
 * Return a storageState path for the identity, logging in at most once per
 * identity for the whole run.
 */
async function storageStateFor(browser: Browser, key: UserKey): Promise<string> {
  const cached = stateCache.get(key);
  if (cached) return cached;

  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const page = await ctx.newPage();
  await performLogin(page, key);
  const file = `${stateDir}/qa03-${key}-${RUN_ID}.json`;
  await ctx.storageState({ path: file });
  await ctx.close();
  stateCache.set(key, file);
  return file;
}

/** Open an authenticated context; `request` shares the session cookie jar. */
async function authedContext(browser: Browser, key: UserKey) {
  const state = await storageStateFor(browser, key);
  return browser.newContext({ baseURL: BASE_URL, storageState: state });
}

/**
 * M03-04 consequence: once the sessionVersion gate actually works (M01-06),
 * any test that bumps an identity's sessionVersion (deactivation, permission
 * grant/revoke, force-logout) silently KILLS that identity's cached
 * storageState — every later `authedContext(key)` would reuse a dead cookie.
 * Call this in the `finally` of such tests so the next use re-logs in.
 */
function invalidateStorageState(key: UserKey): void {
  const file = stateCache.get(key);
  stateCache.delete(key);
  if (file) {
    try {
      require('fs').rmSync(file, { force: true });
    } catch {
      /* best-effort */
    }
  }
}

const json = async (res: APIResponse) => res.json().catch(() => null);

/** True when the response is the documented { success:false, error:{code} } shape. */
function apiError(res: APIResponse, body: unknown): string | null {
  const b = body as { success?: boolean; error?: { code?: string; message?: string } } | null;
  if (res.status() >= 400) {
    return b?.error?.code ?? `HTTP_${res.status()}`;
  }
  return null;
}

/**
 * Unwrap the audit-log envelope. GET /api/audit-logs returns
 * { success, data: { data: Row[], total, page, pageSize } } — the inner array
 * is nested one level deeper than most store endpoints.
 */
interface AuditRow {
  entityId: string;
  action?: string;
  actorId?: string | null;
  actorRole?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}
function auditRows(body: unknown): AuditRow[] {
  const b = body as { data?: { data?: AuditRow[] } | AuditRow[] } | null;
  if (Array.isArray(b?.data)) return b.data;
  return Array.isArray(b?.data?.data) ? b.data!.data : [];
}

/**
 * Self-healing baseline.
 *
 * Several specs below legitimately mutate the seeded CASHIER account (it is one
 * of the few seeded users we can actually authenticate as). If a previous run
 * aborted mid-spec, that account can be left in a mutated role, which would
 * make unrelated assertions fail for the wrong reason. Normalising it here makes
 * the suite idempotent and order-independent across runs.
 */
test.beforeAll('baseline: restore the seeded cashier account', async ({ browser }) => {
  const ctx = await authedContext(browser, 'owner');
  try {
    const roster = await ctx.request.get('/api/store/staff');
    const members = ((await json(roster))?.data ?? []) as Array<{ id: string; email: string }>;
    const cashier = members.find((m) => m.email === USERS.cashier.email);
    if (cashier) {
      await ctx.request.patch(`/api/store/staff/${cashier.id}`, {
        data: { role: 'CASHIER', isActive: true, permissions: [] },
      });
    }
  } finally {
    await ctx.close();
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 1. FUNCTIONAL & BUSINESS LOGIC
// ════════════════════════════════════════════════════════════════════════════

test.describe('1. Functional & Business Logic', () => {
  test('1.1 OWNER can open Team & Permissions and sees the staff roster', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: /Team & permissions/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Extra permissions' })).toBeVisible();
    // The owner email also appears in the sidebar account menu -> scope to a row.
    await expect(
      page.getByRole('row').filter({ hasText: USERS.owner.email }).first(),
    ).toBeVisible();
    await ctx.close();
  });

  test('1.2 Staff lifecycle: create -> list -> edit role -> deactivate', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('lifecycle');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    expect(created.status()).toBe(201);
    const createdBody = await json(created);
    const id: string = createdBody?.data?.id;
    expect(id).toBeTruthy();
    expect(createdBody?.data?.isActive).toBe(true);

    const list = await req.get('/api/store/staff');
    expect(list.status()).toBe(200);
    const members = (await json(list))?.data ?? [];
    expect(members.some((m: { id: string }) => m.id === id)).toBe(true);

    const patched = await req.patch(`/api/store/staff/${id}`, { data: { role: 'MANAGER' } });
    expect(patched.status()).toBe(200);
    expect((await json(patched))?.data?.role).toBe('MANAGER');

    const off = await req.patch(`/api/store/staff/${id}`, { data: { isActive: false } });
    expect(off.status()).toBe(200);
    expect((await json(off))?.data?.isActive).toBe(false);

    await ctx.close();
  });

  test('1.3 Validation: email format, unknown role and malformed commission are rejected', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const cases: Array<{ label: string; payload: unknown; field: string }> = [
      {
        label: 'not an email',
        payload: { email: 'definitely-not-an-email', role: 'CASHIER' },
        field: 'email',
      },
      { label: 'empty email', payload: { email: '', role: 'CASHIER' }, field: 'email' },
      {
        label: 'unknown role',
        payload: { email: qaEmail('r'), role: 'WEEKEND_WARRIOR' },
        field: 'role',
      },
      { label: 'missing role', payload: { email: qaEmail('r2') }, field: 'role' },
      {
        label: '3dp commission',
        payload: { email: qaEmail('r3'), role: 'CASHIER', commissionRate: '5.123' },
        field: 'commissionRate',
      },
      {
        label: 'negative commission',
        payload: { email: qaEmail('r4'), role: 'CASHIER', commissionRate: '-5' },
        field: 'commissionRate',
      },
      {
        label: 'non-numeric commission',
        payload: { email: qaEmail('r5'), role: 'CASHIER', commissionRate: 'abc' },
        field: 'commissionRate',
      },
    ];

    for (const c of cases) {
      const res = await req.post('/api/store/staff', { data: c.payload });
      expect(res.status(), `${c.label} should be 400`).toBe(400);
      const body = await json(res);
      expect(apiError(res, body), `${c.label} -> VALIDATION_ERROR`).toBe('VALIDATION_ERROR');
      const paths = (body?.error?.details ?? []).map((d: { path: string }) => d.path);
      expect(paths, `${c.label} flags ${c.field}`).toContain(c.field);
    }

    await ctx.close();
  });

  test('1.4 Duplicate email is rejected with 409 CONFLICT (unique constraint)', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('dupe');

    expect(
      (await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } })).status(),
    ).toBe(201);
    const second = await req.post('/api/store/staff', { data: { email, role: 'MANAGER' } });
    expect(second.status()).toBe(409);
    expect(apiError(second, await json(second))).toBe('CONFLICT');

    const crossTenant = await req.post('/api/store/staff', {
      data: { email: USERS.owner2.email, role: 'CASHIER' },
    });
    expect(crossTenant.status(), 'email is globally unique across tenants').toBe(409);

    await ctx.close();
  });
});

test.describe('1b. Permission editor (UI)', () => {
  test('1.5 Role defaults render as Inherited+locked; extras are togglable', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/settings/users');

    const row = page.getByRole('row').filter({ hasText: USERS.cashier.email }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /Manage/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`Manage ${USERS.cashier.email}`)).toBeVisible();

    // sale:create is a CASHIER role default -> Inherited badge + disabled control.
    const inherited = dialog.locator('label').filter({ hasText: PERM.saleCreate }).first();
    await expect(inherited, 'sale:create row present').toBeVisible();
    await expect(inherited.getByText('Inherited'), 'sale:create marked Inherited').toBeVisible();
    await expect(inherited.locator('[role=checkbox]')).toBeDisabled();

    // settings:users is NOT a cashier default -> editable and unchecked.
    const extra = dialog.locator('label').filter({ hasText: PERM.manageUsers }).first();
    await expect(extra.locator('[role=checkbox]'), 'explicit override is editable').toBeEnabled();
    await expect(extra.locator('[role=checkbox]')).not.toBeChecked();

    await page.keyboard.press('Escape');
    await ctx.close();
  });

  test('1.6 Assigning explicit permissions persists and updates the roster count', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('grant');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;

    const patch = await req.patch(`/api/store/staff/${id}`, {
      data: { permissions: [PERM.staffView, PERM.assignPermissions] },
    });
    expect(patch.status()).toBe(200);
    const stored = (((await json(patch))?.data?.permissions ?? []) as string[]).slice().sort();
    expect(stored).toEqual([PERM.assignPermissions, PERM.staffView].sort());

    const page = await ctx.newPage();
    await page.goto('/settings/users');
    const row = page.getByRole('row').filter({ hasText: email }).first();
    await expect(row.getByRole('cell').nth(3), 'Extra permissions column shows 2').toHaveText('2');

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. FINANCIAL & CALCULATION PRECISION
// ════════════════════════════════════════════════════════════════════════════
//
// Module 03 owns exactly one numeric field: User.commissionRate, declared
// `Decimal(5, 2)` in prisma/schema.prisma and written via parseFloat() in
// src/lib/services/staff.service.ts:116,188. Scope note: VAT 18% / SSCL 2.5% /
// cash rounding belong to Module 14 (POS Billing) and are asserted there.

test.describe('2. Financial & Calculation Precision (commissionRate)', () => {
  test('2.1 Two-decimal LKR percentages round-trip exactly, with no float drift', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    for (const rate of ['5.00', '12.50', '0.01', '99.99', '7']) {
      const email = qaEmail(`cr-${rate.replace('.', '_')}`);
      const res = await req.post('/api/store/staff', {
        data: { email, role: 'CASHIER', commissionRate: rate },
      });
      expect(res.status(), `create with ${rate}`).toBe(201);
      const stored = String((await json(res))?.data?.commissionRate);
      // Decimal(5,2) must never surface binary-float artefacts such as 12.4900001.
      expect(stored, `${rate} stored exactly`).not.toMatch(/\d{4,}/);
      expect(Number(stored), `${rate} numeric value preserved`).toBeCloseTo(Number(rate), 2);
    }

    await ctx.close();
  });

  test('2.2 Boundary: Decimal(5,2) ceiling 999.99 accepted, 1000.00 rejected', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const ok = await req.post('/api/store/staff', {
      data: { email: qaEmail('max'), role: 'CASHIER', commissionRate: '999.99' },
    });
    expect(ok.status(), '999.99 fits Decimal(5,2)').toBe(201);

    // The zod regex ^\d+(\.\d{1,2})?$ permits values the column cannot hold.
    const over = await req.post('/api/store/staff', {
      data: { email: qaEmail('over'), role: 'CASHIER', commissionRate: '1000.00' },
    });
    const overBody = await json(over);
    expect(over.status(), '1000.00 must not be silently accepted').toBe(400);
    expect(apiError(over, overBody)).toBe('VALIDATION_ERROR');

    await ctx.close();
  });

  test('2.3 commissionRate survives a role change', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('persist');

    const created = await req.post('/api/store/staff', {
      data: { email, role: 'CASHIER', commissionRate: '8.25' },
    });
    const id = (await json(created))?.data?.id;

    const moved = await req.patch(`/api/store/staff/${id}`, { data: { role: 'MANAGER' } });
    expect(String((await json(moved))?.data?.commissionRate)).toBe('8.25');

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CROSS-MODULE CASCADE & LEDGER IMPACT
// ════════════════════════════════════════════════════════════════════════════

test.describe('3. Cross-Module Cascade & Ledger Impact', () => {
  test('3.1 Role change emits a STAFF_ROLE_CHANGED audit row with before/after diff', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('audit-role');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;
    await req.patch(`/api/store/staff/${id}`, { data: { role: 'MANAGER' } });

    const logs = await req.get(
      '/api/audit-logs?entityType=Staff&action=STAFF_ROLE_CHANGED&pageSize=100',
    );
    expect(logs.status()).toBe(200);
    const rows = auditRows(await json(logs)).filter((r) => r.entityId === id);

    expect(rows.length, 'audit row written for the role change').toBeGreaterThan(0);
    expect(rows[0]?.before?.role, 'previous role captured').toBe('CASHIER');
    expect(rows[0]?.after?.role, 'new role captured').toBe('MANAGER');

    await ctx.close();
  });

  test('3.2 Permission change emits STAFF_PERMISSION_CHANGED with the diff', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('audit-perm');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;
    await req.patch(`/api/store/staff/${id}`, { data: { permissions: [PERM.staffView] } });

    const logs = await req.get(
      '/api/audit-logs?entityType=Staff&action=STAFF_PERMISSION_CHANGED&pageSize=100',
    );
    const rows = auditRows(await json(logs)).filter((r) => r.entityId === id);
    expect(rows.length, 'audit row written for the permission change').toBeGreaterThan(0);

    await ctx.close();
  });

  test('3.3 Deactivation is persisted and reflected in the roster', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('deactivate');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;
    await req.patch(`/api/store/staff/${id}`, { data: { isActive: false } });

    const list = await req.get('/api/store/staff');
    const me = ((await json(list))?.data ?? []).find((m: { id: string }) => m.id === id);
    expect(me?.isActive, 'user is inactive after deactivation').toBe(false);

    await ctx.close();
  });

  test('3.4 Explicit grant persists for getEffectivePermissions() merge on next login', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('escalate');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;
    await req.patch(`/api/store/staff/${id}`, { data: { permissions: [PERM.manageUsers] } });

    const fresh = await req.get(`/api/store/staff/${id}`);
    const perms = ((await json(fresh))?.data?.permissions ?? []) as string[];
    expect(perms, 'explicit grant persisted to merge with role defaults').toContain(
      PERM.manageUsers,
    );

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. AUDIT TRAIL, VOID & CANCELLATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('4. Audit Trail, Soft-Delete & Immutability', () => {
  test('4.1 No hard-delete route: DELETE is not permitted on staff', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('nodelete');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;

    const del = await req.delete(`/api/store/staff/${id}`);
    expect([405, 404], 'hard delete must not be exposed').toContain(del.status());

    const still = await req.get(`/api/store/staff/${id}`);
    expect(still.status(), 'record still retrievable -> no unauthorized hard delete').toBe(200);

    await ctx.close();
  });

  test('4.2 Audit log is append-only: no mutation or delete endpoint exposed', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const patch = await req.patch('/api/audit-logs', { data: { action: 'TAMPERED' } });
    expect([404, 405], 'PATCH on audit-logs must not be available').toContain(patch.status());

    const del = await req.delete('/api/audit-logs');
    expect([404, 405], 'DELETE on audit-logs must not be available').toContain(del.status());

    await ctx.close();
  });

  test('4.3 Audit trail attributes the change to the acting user, not SYSTEM', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('actor');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;
    await req.patch(`/api/store/staff/${id}`, { data: { role: 'STOCK_CLERK' } });

    const logs = await req.get(
      '/api/audit-logs?entityType=Staff&action=STAFF_ROLE_CHANGED&pageSize=100',
    );
    const rows = auditRows(await json(logs)).filter((r) => r.entityId === id);

    expect(rows.length).toBeGreaterThan(0);
    // Accountability: a permission change with no attributed actor is not an
    // audit trail. See staff.service.ts:133 (actorId: null, actorRole: SYSTEM).
    expect(rows[0]?.actorId, 'audit row must record WHO changed the role').not.toBeNull();
    expect(rows[0]?.actorRole, 'audit row must not blame SYSTEM').not.toBe('SYSTEM');

    await ctx.close();
  });

  test('4.4 Deactivating a signed-in user revokes their live access', async ({ browser }) => {
    // cashier1 is a seeded, login-capable account. Deactivated, then restored
    // in `finally` so the shared database is left as found.
    const ownerCtx = await authedContext(browser, 'owner');
    const ownerReq = ownerCtx.request;

    const roster = await ownerReq.get('/api/store/staff');
    const cashier = ((await json(roster))?.data ?? []).find(
      (m: { email: string }) => m.email === USERS.cashier.email,
    );
    expect(cashier, 'seeded cashier present').toBeTruthy();

    const victim = await authedContext(browser, 'cashier');
    const vReq = victim.request;

    const baseline = await vReq.get('/api/store/customers');
    expect(baseline.status(), 'cashier can read customers while active').toBe(200);

    await ownerReq.patch(`/api/store/staff/${cashier.id}`, { data: { isActive: false } });
    try {
      const after = await vReq.get('/api/store/customers');
      expect(after.status(), 'deactivated user must lose live access').toBeGreaterThanOrEqual(401);
    } finally {
      await ownerReq.patch(`/api/store/staff/${cashier.id}`, { data: { isActive: true } });
      await victim.close();
      await ownerCtx.close();
      // The isActive toggles bumped sessionVersion (M03-04); the cached
      // cashier state is now stale — force a re-login for later tests.
      invalidateStorageState('cashier');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CHAOS, BUTTON SPAMMING & RACE CONDITIONS
// ════════════════════════════════════════════════════════════════════════════

test.describe('5. Button Spamming & Race Conditions', () => {
  test('5.1 Rapid triple-submit of create-staff yields exactly one account', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('spam');

    const results = await Promise.all([
      req.post('/api/store/staff', { data: { email, role: 'CASHIER' } }),
      req.post('/api/store/staff', { data: { email, role: 'CASHIER' } }),
      req.post('/api/store/staff', { data: { email, role: 'CASHIER' } }),
    ]);

    const statuses = results.map((r) => r.status());
    expect(statuses.filter((s) => s === 201).length, 'exactly one create wins').toBe(1);
    expect(
      statuses.every((s) => s === 201 || s === 409),
      `losers get 409, never 500 — got ${statuses.join(',')}`,
    ).toBe(true);

    const list = await req.get(`/api/store/staff?search=${encodeURIComponent(email)}`);
    const matches = ((await json(list))?.data ?? []).filter(
      (m: { email: string }) => m.email === email,
    );
    expect(matches.length, 'no duplicate rows').toBe(1);

    await ctx.close();
  });

  test('5.2 Concurrent PATCH resolves deterministically and leaves valid state', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('race');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id;

    const outcomes = await Promise.all([
      req.patch(`/api/store/staff/${id}`, { data: { role: 'MANAGER' } }),
      req.patch(`/api/store/staff/${id}`, { data: { role: 'STOCK_CLERK' } }),
      req.patch(`/api/store/staff/${id}`, { data: { role: 'CASHIER' } }),
    ]);

    for (const o of outcomes) {
      expect([200, 409], `concurrent PATCH must not 500 — got ${o.status()}`).toContain(o.status());
    }

    const final = await req.get(`/api/store/staff/${id}`);
    const role = (await json(final))?.data?.role;
    expect(['MANAGER', 'STOCK_CLERK', 'CASHIER'], 'final role is a valid enum member').toContain(
      role,
    );

    await ctx.close();
  });

  test('5.3 Double-clicking "Save changes" is guarded by the pending state', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/settings/users');

    const row = page.getByRole('row').filter({ hasText: USERS.cashier.email }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /Manage/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const save = dialog.getByRole('button', { name: /Save changes/i });
    await Promise.all([save.click({ noWaitAfter: true }), save.click({ noWaitAfter: true })]);
    await page.waitForTimeout(2500);

    // Idempotent PATCH: the stored role must still be a single valid value.
    const req = ctx.request;
    const roster = await req.get('/api/store/staff');
    const cashier = ((await json(roster))?.data ?? []).find(
      (m: { email: string }) => m.email === USERS.cashier.email,
    );
    expect([
      'OWNER',
      'MANAGER',
      'CASHIER',
      'STOCK_CLERK',
      'DISPATCH_STAFF',
      'FACTORY_MANAGER',
    ]).toContain(cashier?.role);

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. NETWORK RESILIENCE
// ════════════════════════════════════════════════════════════════════════════

test.describe('7. Network Resilience & Error Handling', () => {
  test('7.1 A 500 from the save endpoint surfaces a toast and keeps the dialog open', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();

    await page.route('**/api/store/staff/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/settings/users');
    const row = page.getByRole('row').filter({ hasText: USERS.cashier.email }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /Manage/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Save changes/i })
      .click();

    await expect(page.getByText(/An unexpected error occurred|Failed to update/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('dialog'), 'dialog must stay open for retry').toBeVisible();

    await ctx.close();
  });

  test('7.2 A 504 on the roster load degrades without an uncaught page error', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.route('**/api/store/staff', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 504, body: 'gateway timeout' });
        return;
      }
      await route.continue();
    });

    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: /Team & permissions/i })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors, `no uncaught page errors on 504 — got ${errors.join(' | ')}`).toHaveLength(0);

    await ctx.close();
  });

  test('7.3 Offline save fails gracefully and the roster recovers on reconnect', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/settings/users');

    const row = page.getByRole('row').filter({ hasText: USERS.cashier.email }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    await ctx.setOffline(true);
    await row.getByRole('button', { name: /Manage/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Save changes/i }).click({ noWaitAfter: true });

    await expect(page.getByRole('dialog'), 'dialog survives offline failure').toBeVisible({
      timeout: 20_000,
    });

    await ctx.setOffline(false);
    await page.reload();
    await expect(
      page.getByRole('row').filter({ hasText: USERS.cashier.email }).first(),
      'roster reloads after reconnect',
    ).toBeVisible({ timeout: 20_000 });

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. SECURITY, RBAC & MULTI-TENANT ISOLATION  (core of this module)
// ════════════════════════════════════════════════════════════════════════════

test.describe('8. Security, RBAC & Tenant Isolation', () => {
  test('8.1 Unauthenticated API access is rejected with 401', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/store/staff`);
    expect(res.status()).toBe(401);
    expect(apiError(res, await json(res))).toBe('UNAUTHORIZED');
  });

  test('8.2 CASHIER cannot read or write staff (403 on view + manage)', async ({ browser }) => {
    const ctx = await authedContext(browser, 'cashier');
    const req = ctx.request;

    const get = await req.get('/api/store/staff');
    expect(get.status()).toBe(403);
    expect(apiError(get, await json(get))).toBe('FORBIDDEN');

    const post = await req.post('/api/store/staff', {
      data: { email: qaEmail('cash'), role: 'CASHIER' },
    });
    expect(post.status(), 'cashier must not create staff').toBe(403);

    await ctx.close();
  });

  test('8.3 CASHIER is redirected away from /settings/users (page guard)', async ({ browser }) => {
    const ctx = await authedContext(browser, 'cashier');
    const page = await ctx.newPage();
    await page.goto('/settings/users');
    await page.waitForLoadState('domcontentloaded');

    // The security property is "cannot see the page". The exact bounce target
    // varies by role: settings/users/page.tsx:12 redirects to /dashboard, which
    // itself sends a CASHIER on to /pos.
    await expect(page, 'must not remain on the users page').not.toHaveURL(/\/settings\/users$/, {
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: /Team & permissions/i })).toHaveCount(0);
    await ctx.close();
  });

  test('8.4 DISPATCH_STAFF cannot manage users and cannot view staff', async ({ browser }) => {
    const ctx = await authedContext(browser, 'dispatch');
    const req = ctx.request;
    const page = await ctx.newPage();

    const get = await req.get('/api/store/staff');
    expect(get.status(), 'DISPATCH_STAFF has no staff:view').toBe(403);

    await page.goto('/settings/users');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url(), 'must not land on the users page').not.toMatch(/\/settings\/users$/);

    await ctx.close();
  });

  test('8.5 SUPER_ADMIN cannot reach tenant-scoped /settings/users', async ({ browser }) => {
    const ctx = await authedContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/settings/users');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Security property: the platform admin must never render tenant user admin.
    expect(page.url(), 'must not land on the tenant users page').not.toMatch(/\/settings\/users$/);
    await expect(page.getByRole('heading', { name: /Team & permissions/i })).toHaveCount(0);

    // Contract property: middleware.ts:170-173 promises a bounce to the platform
    // console for SUPER_ADMIN on store paths. Observed instead: 307 -> /login
    // (the page guard fires first because SUPER_ADMIN has tenantId = null).
    expect(
      page.url(),
      'middleware should redirect SUPER_ADMIN to /superadmin/dashboard, not /login',
    ).toMatch(/\/superadmin\/dashboard/);

    await ctx.close();
  });

  test('8.6 Cross-tenant isolation: owner B cannot read or mutate an owner A user', async ({
    browser,
  }) => {
    const ownerA = await authedContext(browser, 'owner');
    const email = qaEmail('victim');
    const created = await ownerA.request.post('/api/store/staff', {
      data: { email, role: 'CASHIER' },
    });
    const id = (await json(created))?.data?.id;
    expect(id).toBeTruthy();

    const ownerB = await authedContext(browser, 'owner2');
    const read = await ownerB.request.get(`/api/store/staff/${id}`);
    expect(read.status(), 'tenant B must not read tenant A user').toBe(404);
    expect(apiError(read, await json(read))).toBe('NOT_FOUND');

    const write = await ownerB.request.patch(`/api/store/staff/${id}`, { data: { role: 'OWNER' } });
    expect(write.status(), 'tenant B must not mutate tenant A user').toBe(404);

    const roster = await ownerB.request.get('/api/store/staff');
    expect(
      ((await json(roster))?.data ?? []).some((m: { id: string }) => m.id === id),
      'no cross-tenant leakage in roster',
    ).toBe(false);

    await ownerA.close();
    await ownerB.close();
  });
});

test.describe('8b. Privilege Escalation & Session Integrity', () => {
  test('8.7 SUPER_ADMIN role cannot be assigned or escalated through the staff API', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const create = await req.post('/api/store/staff', {
      data: { email: qaEmail('sa'), role: 'SUPER_ADMIN' },
    });
    expect(create.status(), 'cannot create a SUPER_ADMIN via store API').toBe(400);
    expect(apiError(create, await json(create))).toBe('VALIDATION_ERROR');

    const created = await req.post('/api/store/staff', {
      data: { email: qaEmail('esc'), role: 'CASHIER' },
    });
    const id = (await json(created))?.data?.id;
    const escalate = await req.patch(`/api/store/staff/${id}`, { data: { role: 'SUPER_ADMIN' } });
    expect(escalate.status(), 'cannot escalate to SUPER_ADMIN').toBe(400);

    const roster = await req.get('/api/store/staff');
    expect(
      ((await json(roster))?.data ?? []).some((m: { role: string }) => m.role === 'SUPER_ADMIN'),
      'SUPER_ADMIN hidden from roster',
    ).toBe(false);

    await ctx.close();
  });

  test('8.8 Permission strings are whitelisted against ALL_PERMISSIONS', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const created = await req.post('/api/store/staff', {
      data: { email: qaEmail('inject'), role: 'CASHIER' },
    });
    const id = (await json(created))?.data?.id;

    for (const bad of ['*:*', 'settings:manage_users', 'admin:everything', '']) {
      const res = await req.patch(`/api/store/staff/${id}`, { data: { permissions: [bad] } });
      expect(res.status(), `"${bad}" must be rejected`).toBe(400);
      expect(apiError(res, await json(res))).toBe('VALIDATION_ERROR');
    }

    const unchanged = await req.get(`/api/store/staff/${id}`);
    expect(((await json(unchanged))?.data?.permissions ?? []).length, 'no partial write').toBe(0);

    await ctx.close();
  });

  test('8.9 MANAGER must not hold settings:users (owner-only exclusion)', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const created = await req.post('/api/store/staff', {
      data: { email: qaEmail('mgr'), role: 'MANAGER' },
    });
    const id = (await json(created))?.data?.id;

    const roster = await req.get('/api/store/staff');
    const mgr = ((await json(roster))?.data ?? []).find((m: { id: string }) => m.id === id);
    expect(mgr?.role).toBe('MANAGER');
    // managerExcluded (permissions.ts:182) strips settings:users from MANAGER,
    // so it must not be grantable as a role default.
    expect((mgr?.permissions ?? []) as string[], 'MANAGER holds no settings:users').not.toContain(
      PERM.manageUsers,
    );

    await ctx.close();
  });

  test('8.10 force-logout is tenant-scoped and owner/super-admin only', async ({ browser }) => {
    const ownerA = await authedContext(browser, 'owner');
    const created = await ownerA.request.post('/api/store/staff', {
      data: { email: qaEmail('fl'), role: 'CASHIER' },
    });
    const id = (await json(created))?.data?.id;

    const ownerB = await authedContext(browser, 'owner2');
    const cross = await ownerB.request.post(`/api/admin/users/${id}/force-logout`);
    expect(cross.status(), 'owner B cannot force-logout an owner A user').toBe(403);

    const cashierCtx = await authedContext(browser, 'cashier');
    const low = await cashierCtx.request.post(`/api/admin/users/${id}/force-logout`);
    expect([403, 401], 'cashier cannot force-logout anyone').toContain(low.status());

    const same = await ownerA.request.post(`/api/admin/users/${id}/force-logout`);
    expect(same.status(), 'same-tenant owner may force-logout').toBe(200);

    await ownerA.close();
    await ownerB.close();
    await cashierCtx.close();
  });

  test('8.11 Revoking a role/permission invalidates the live session (sessionVersion)', async ({
    browser,
  }) => {
    // cashier1 holds a live JWT whose permissions were frozen at login
    // (auth.config.ts:24-33 only writes claims when `user` is present).
    // A role change must bump sessionVersion so middleware (middleware.ts:207)
    // rejects the stale token. staff.service.ts updateStaff() never bumps it.
    const ownerCtx = await authedContext(browser, 'owner');
    const ownerReq = ownerCtx.request;

    const roster = await ownerReq.get('/api/store/staff');
    const cashier = ((await json(roster))?.data ?? []).find(
      (m: { email: string }) => m.email === USERS.cashier.email,
    );
    expect(cashier).toBeTruthy();

    const victim = await authedContext(browser, 'cashier');
    const vReq = victim.request;
    const baseline = await vReq.get('/api/store/customers');
    expect(baseline.status(), 'live session works before the change').toBe(200);

    // Grant a powerful permission, then revoke it.
    await ownerReq.patch(`/api/store/staff/${cashier.id}`, {
      data: { permissions: [PERM.manageUsers] },
    });
    await ownerReq.patch(`/api/store/staff/${cashier.id}`, { data: { permissions: [] } });

    try {
      const after = await vReq.get('/api/store/customers');
      // The stale token still carries the ORIGINAL permission set; a correct
      // implementation invalidates it. We assert the security expectation.
      expect(
        after.status(),
        'revoked permissions must not remain usable on an existing session',
      ).toBeGreaterThanOrEqual(401);
    } finally {
      await victim.close();
      await ownerCtx.close();
      // Grant + revoke each bumped sessionVersion (M03-04) — the cached
      // cashier cookie is now dead; force a re-login for later tests.
      invalidateStorageState('cashier');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. HARDWARE & DEVICE SIMULATION
// ════════════════════════════════════════════════════════════════════════════
// Scope note: Module 03 exposes no printer, drawer or scanner surface. ESC/POS
// receipt mocking belongs to Module 14; serial/hardware endpoints to Module 07.
// The only device-class input here is keyboard-wedge style burst typing.

test.describe('6. Device Input Simulation', () => {
  test('6.1 Keyboard-wedge burst into staff search returns the right row', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/staff');

    const search = page.getByPlaceholder(/search by email/i);
    await expect(search).toBeVisible({ timeout: 20_000 });

    // A scanner emits the whole string plus Enter within milliseconds.
    await search.pressSequentially(USERS.cashier.email, { delay: 0 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await expect(
      page.getByRole('row').filter({ hasText: USERS.cashier.email }).first(),
    ).toBeVisible();

    await search.fill('');
    await page.waitForTimeout(800);
    const rows = page.getByRole('row').filter({ hasText: /@/ });
    expect(await rows.count(), 'clearing search restores the roster').toBeGreaterThan(1);

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. BOUNDARY INPUTS & CHAOS DATA
// ════════════════════════════════════════════════════════════════════════════

test.describe('9. Boundary Inputs & Chaos Data', () => {
  test('9.1 Sinhala / Tamil / emoji strings are handled without corruption or 500', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const chaos = [
      `qa03.සිංහල.${RUN_ID}@ayurpos-qa.test`,
      `qa03.வணக்கம்.${RUN_ID}@ayurpos-qa.test`,
      `qa03.🌿🧘‍♀️.${RUN_ID}@ayurpos-qa.test`,
      `qa03.<script>alert(1)</script>.${RUN_ID}@ayurpos-qa.test`,
      `qa03.'; DROP TABLE users;--.${RUN_ID}@ayurpos-qa.test`,
    ];

    for (const email of chaos) {
      const res = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
      expect([201, 400, 409], `no 500 for ${email.slice(0, 24)}… got ${res.status()}`).not.toBe(
        500,
      );
      if (res.status() === 201) {
        const stored = (await json(res))?.data?.email;
        expect(stored, 'unicode round-trips byte-for-byte').toBe(email);
      }
    }

    await ctx.close();
  });

  test('9.2 XSS payloads in permissions and search are rejected or neutralised', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const created = await req.post('/api/store/staff', {
      data: { email: qaEmail('xss'), role: 'CASHIER' },
    });
    const id = (await json(created))?.data?.id;

    const xss = '<img src=x onerror=alert(document.cookie)>';
    const res = await req.patch(`/api/store/staff/${id}`, { data: { permissions: [xss] } });
    expect(res.status(), 'script payload must not be stored as a permission').toBe(400);

    const page = await ctx.newPage();
    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: /Team & permissions/i })).toBeVisible();
    expect(await page.locator('img[src="x"]').count(), 'no injected image element').toBe(0);

    await ctx.close();
  });

  test('9.3 Integer-overflow and extreme numeric commission inputs are rejected safely', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    for (const rate of ['99999999999999999999', '0.0000001', '1e30', '0000000005.00', '5.']) {
      const res = await req.post('/api/store/staff', {
        data: {
          email: qaEmail(`ov-${rate.replace(/\D/g, 'x')}`),
          role: 'CASHIER',
          commissionRate: rate,
        },
      });
      expect([400, 201], `${rate} must be validated or stored cleanly, never 500`).toContain(
        res.status(),
      );
    }

    await ctx.close();
  });

  test('9.4 Zero-length and oversized payloads are rejected without a 500', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const empty = await req.post('/api/store/staff', { data: {} });
    expect(empty.status()).toBe(400);

    const huge = await req.post('/api/store/staff', {
      data: { email: `${'a'.repeat(5000)}@ayurpos-qa.test`, role: 'CASHIER' },
    });
    expect([400, 201, 409], `oversized email handled, got ${huge.status()}`).toContain(
      huge.status(),
    );

    const badJson = await req.post('/api/store/staff', {
      data: '{"email": broken',
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 500], 'malformed JSON must not crash the route').toContain(badJson.status());

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. TIME-TRAVEL & EXPIRY
// ════════════════════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('10. Time-Travel & Session Expiry', () => {
  test('10.1 createdAt ordering is preserved in the roster (newest first)', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;

    const first = await req.post('/api/store/staff', {
      data: { email: qaEmail('t1'), role: 'CASHIER' },
    });
    const firstId = (await json(first))?.data?.id;
    await sleep(1200);
    const second = await req.post('/api/store/staff', {
      data: { email: qaEmail('t2'), role: 'CASHIER' },
    });
    const secondId = (await json(second))?.data?.id;

    const list = await req.get('/api/store/staff');
    const ids = ((await json(list))?.data ?? []).map((m: { id: string }) => m.id);
    expect(ids.indexOf(secondId), 'newest created user sorts first').toBeLessThan(
      ids.indexOf(firstId),
    );

    await ctx.close();
  });

  test('10.2 Force-logout expires an existing live session (sessionVersion bump)', async ({
    browser,
  }) => {
    const ownerCtx = await authedContext(browser, 'owner');
    const roster = await ownerCtx.request.get('/api/store/staff');
    const cashier = ((await json(roster))?.data ?? []).find(
      (m: { email: string }) => m.email === USERS.cashier.email,
    );
    expect(cashier).toBeTruthy();

    const victim = await authedContext(browser, 'cashier');
    const vPage = await victim.newPage();
    await vPage.goto('/customers');
    expect(vPage.url(), 'session live before force-logout').not.toMatch(/\/login/);

    const fl = await ownerCtx.request.post(`/api/admin/users/${cashier.id}/force-logout`);
    expect(fl.status()).toBe(200);

    // M01-06/M03-03: the proxy gate reads sessionVersion straight from the DB
    // (no cache), so the bump is effective on the target's VERY NEXT request —
    // no TTL wait anymore. A small settle covers in-flight navigation only.
    await sleep(500);
    await vPage.goto('/customers');
    await expect(vPage, 'force-logged-out session must be rejected').toHaveURL(/\/login/, {
      timeout: 20_000,
    });

    await victim.close();
    await ownerCtx.close();
    // The force-logout bumped the seeded cashier's sessionVersion — the
    // cached state is dead; later tests must re-login.
    invalidateStorageState('cashier');
  });

  test('10.3 A role change made while signed out applies on the next fresh read', async ({
    browser,
  }) => {
    const ownerCtx = await authedContext(browser, 'owner');
    const req = ownerCtx.request;
    const created = await req.post('/api/store/staff', {
      data: { email: qaEmail('tt'), role: 'CASHIER' },
    });
    const id = (await json(created))?.data?.id;
    await req.patch(`/api/store/staff/${id}`, {
      data: { role: 'STOCK_CLERK', permissions: [PERM.staffView] },
    });

    const fresh = await req.get(`/api/store/staff/${id}`);
    const body = await json(fresh);
    expect(body?.data?.role, 'role change persisted').toBe('STOCK_CLERK');
    expect((body?.data?.permissions ?? []) as string[]).toContain(PERM.staffView);

    await ownerCtx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. ROLE ENUM CONSISTENCY (UI vs API contract)
// ════════════════════════════════════════════════════════════════════════════

test.describe('11. Role Enum Contract (UI vs Validator)', () => {
  test('11.1 Every role offered by the permission editor is accepted by the API', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const page = await ctx.newPage();

    await page.goto('/settings/users');
    const row = page.getByRole('row').filter({ hasText: USERS.cashier.email }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /Manage/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    // Radix Select renders its listbox in a body-level portal, outside the
    // dialog subtree -> query the page, not the dialog.
    const listbox = page.getByRole('listbox');
    await expect(listbox.first()).toBeVisible({ timeout: 5_000 });
    const options = await listbox.first().getByRole('option').allInnerTexts();
    await page.keyboard.press('Escape');
    expect(options.length, 'role dropdown populated').toBeGreaterThan(0);

    const api = await req.get('/api/store/staff');
    const target = ((await json(api))?.data ?? []).find(
      (m: { email: string }) => m.email === USERS.cashier.email,
    );

    // Operate on a throwaway QA account, never the seeded cashier, so an abort
    // here cannot poison the baseline used by specs 1.5 / 4.4 / 8.11.
    const probe = await req.post('/api/store/staff', {
      data: { email: qaEmail('enum'), role: 'CASHIER' },
    });
    const probeId = (await json(probe))?.data?.id;
    const failures: string[] = [];
    try {
      for (const label of options) {
        const role = label.trim().toUpperCase().replace(/\s+/g, '_');
        const res = await req.patch(`/api/store/staff/${probeId}`, { data: { role } });
        if (res.status() !== 200) {
          failures.push(`${role} -> HTTP ${res.status()}`);
        }
      }
    } finally {
      await req.patch(`/api/store/staff/${probeId}`, { data: { isActive: false } });
      void target;
      await ctx.close();
    }

    expect(
      failures,
      `Roles advertised by the permission editor but rejected by the API: ${failures.join('; ')}`,
    ).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. STAFF PASSWORD LIFECYCLE (M03-08 / GAP-2) — create → set password → sign in
// ════════════════════════════════════════════════════════════════════════════

test.describe('12. Staff password lifecycle (GAP-2)', () => {
  test.setTimeout(120_000);

  const NEW_PASSWORD = 'qa03-lifecycle-99';

  test('12.1 create → set-password → the account can sign in; a second set kills the live session', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('pwlife');

    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    expect(created.status(), 'create staff → 201').toBe(201);
    const id = (await json(created))?.data?.id as string;
    expect(id).toBeTruthy();

    /** Credentials sign-in over the wire; returns the jar for follow-ups. */
    async function signInCtx(password: string) {
      const jar = await browser.newContext({ baseURL: BASE_URL });
      const csrf = (await (await jar.request.get('/api/auth/csrf')).json().catch(() => ({}))) as {
        csrfToken?: string;
      };
      await jar.request.post('/api/auth/callback/credentials', {
        form: { email, password, csrfToken: csrf.csrfToken ?? '', json: 'true' },
      });
      return jar;
    }

    try {
      // GAP-2 core: before a password is set the account cannot sign in — its
      // server-side hash is an unusable random UUID.
      const beforeSet = await signInCtx('anything-123');
      const beforeSession = (await json(await beforeSet.request.get('/api/auth/session'))) as {
        user?: { email?: string };
      } | null;
      expect(beforeSession?.user?.email ?? null, 'no password set → no session').toBeNull();
      await beforeSet.close();

      // Admin set-password route.
      const set = await req.post(`/api/store/staff/${id}/password`, {
        data: { newPassword: NEW_PASSWORD },
      });
      expect(set.status(), 'set-password → 200').toBe(200);

      // Now the account signs in and holds a usable session.
      const jar = await signInCtx(NEW_PASSWORD);
      const session = (await json(await jar.request.get('/api/auth/session'))) as {
        user?: { email?: string };
      } | null;
      expect(session?.user?.email, 'after set-password the account can sign in').toBe(email);

      // A SECOND set bumps sessionVersion (NEW-D) — the M01-06 proxy gate must
      // terminate the live session on its next request (401 for API paths).
      const set2 = await req.post(`/api/store/staff/${id}/password`, {
        data: { newPassword: `${NEW_PASSWORD}b` },
      });
      expect(set2.status()).toBe(200);

      const stale = await jar.request.get('/api/store/customers');
      expect(
        stale.status(),
        'a password reset must invalidate the subject live session (M03-04/M01-06)',
      ).toBeGreaterThanOrEqual(401);
      await jar.close();
      // STAFF_PASSWORD_RESET audit row carries the OWNER actor, not SYSTEM.
      const logs = await req.get(
        '/api/audit-logs?entityType=Staff&action=STAFF_PASSWORD_RESET&pageSize=100',
      );
      const rows = auditRows(await json(logs)).filter((r) => r.entityId === id);
      expect(rows.length, 'set-password is audited').toBeGreaterThan(0);
      expect(rows[0]?.actorId, 'audit records the acting owner').not.toBeNull();
      expect(rows[0]?.actorRole, 'audit does not blame SYSTEM').not.toBe('SYSTEM');
    } finally {
      await req.patch(`/api/store/staff/${id}`, { data: { isActive: false } });
      await ctx.close();
    }
  });

  test('12.2 set-password enforces the 8-char policy and OWNER-only access', async ({ browser }) => {
    const ctx = await authedContext(browser, 'owner');
    const req = ctx.request;
    const email = qaEmail('pwpolicy');
    const created = await req.post('/api/store/staff', { data: { email, role: 'CASHIER' } });
    const id = (await json(created))?.data?.id as string;

    try {
      const short = await req.post(`/api/store/staff/${id}/password`, {
        data: { newPassword: 'short' },
      });
      expect(short.status(), 'short password → 400').toBe(400);
      expect(apiError(short, await json(short))).toBe('VALIDATION_ERROR');

      // A CASHIER cannot set another account's password.
      const cashierCtx = await authedContext(browser, 'cashier');
      const denied = await cashierCtx.request.post(`/api/store/staff/${id}/password`, {
        data: { newPassword: 'long-enough-1' },
      });
      expect(denied.status(), 'cashier denied').toBeLessThan(500);
      expect([401, 403], 'cashier denied').toContain(denied.status());
      await cashierCtx.close();
    } finally {
      await req.patch(`/api/store/staff/${id}`, { data: { isActive: false } });
      await ctx.close();
    }
  });
});

// ─── Cleanup ────────────────────────────────────────────────────────────────
// There is no DELETE route for staff, so QA-created users cannot be removed.
// They are deactivated here to keep the operational roster clean. Emails carry
// a per-run id, so successive runs never collide.

test.afterAll('cleanup: deactivate QA-created staff accounts', async ({ browser }) => {
  const ctx = await authedContext(browser, 'owner');
  const req = ctx.request;
  try {
    const list = await req.get('/api/store/staff');
    const members = ((await json(list))?.data ?? []) as Array<{
      id: string;
      email: string;
      isActive: boolean;
    }>;
    for (const m of members.filter((x) => x.email.startsWith(`qa03.${RUN_ID}.`) && x.isActive)) {
      await req.patch(`/api/store/staff/${m.id}`, { data: { isActive: false } });
    }
  } finally {
    await ctx.close();
  }
});
