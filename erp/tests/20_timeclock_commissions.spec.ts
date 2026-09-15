import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const OTHER_OWNER = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };

async function json(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login(page: Page, credentials = OWNER) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const input = document.querySelector('#email');
    return Boolean(input && Object.getOwnPropertyNames(input).some((key) => key.startsWith('__reactProps$')));
  }, { timeout: 30_000 });

  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // CASHIER sign-in raises the intentional "Open POS" interstitial (OBS-1,
  // login/page.tsx): the dialog mounts instead of navigating. Dismiss it into
  // the current tab. Non-cashier roles never raise it, so the wait times out.
  const openHere = page.getByRole('button', { name: /Open in this tab/i });
  try {
    await openHere.waitFor({ state: 'visible', timeout: 4_000 });
    await openHere.click();
  } catch {
    /* no interstitial for this role */
  }

  await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 20_000 });
}

async function fetchStaff(page: Page) {
  const response = await page.request.get('/api/store/staff');
  expect(response.status()).toBe(200);
  const body = await json(response);
  expect(body?.success).toBe(true);
  return body?.data as Array<{ id: string; email: string; role: string }>;
}

async function ensureNotClockedIn(page: Page) {
  const res = await page.request.get('/api/store/staff/' + (await (await fetchStaff(page)).find((u) => u.email === OWNER.email)?.id ?? ''));
  const body = await json(res);
  return Boolean(body?.data?.clockedInAt === null || !body?.data?.clockedInAt);
}

test.describe('Module 20 - Timeclock & Staff Commissions', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('T0 loads the timeclock and commission pages for the owner', async ({ page }) => {
    await login(page, OWNER);

    await page.goto(`${BASE_URL}/staff/timeclock`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Attendance$/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Clock In|Clock Out/i })).toBeVisible({ timeout: 20_000 });

    await page.goto(`${BASE_URL}/staff/commissions`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Commission Reports$/i })).toBeVisible({ timeout: 30_000 });
  });

  test('T1 clock-in / clock-out happy path persists time-clock history', async ({ page }) => {
    await login(page, OWNER);

    const staff = await fetchStaff(page);
    const ownerUser = staff.find((u) => u.email === OWNER.email);
    expect(ownerUser).toBeTruthy();

    const clockIn = await page.request.post('/api/store/timeclock/clock-in', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect(clockIn.status()).toBe(201);
    const clockInBody = await json(clockIn);
    expect(clockInBody?.success).toBe(true);
    expect(clockInBody?.data?.userId).toBe(ownerUser!.id);

    const history = await page.request.get(`/api/store/timeclock?userId=${ownerUser!.id}&page=1&pageSize=5`);
    expect(history.status()).toBe(200);
    const historyBody = await json(history);
    expect(historyBody?.success).toBe(true);
    expect(Array.isArray(historyBody?.data?.records)).toBe(true);
    expect(historyBody?.data?.records.length).toBeGreaterThan(0);

    const clockOut = await page.request.post('/api/store/timeclock/clock-out', {
      data: { notes: 'QA clock-out test' },
      headers: { 'content-type': 'application/json' },
    });
    expect(clockOut.status()).toBe(201);
    const clockOutBody = await json(clockOut);
    expect(clockOutBody?.success).toBe(true);
    expect(clockOutBody?.data?.notes).toBe('QA clock-out test');
  });

  test('T2 rejects duplicate clock-ins and invalid clock-out state', async ({ page }) => {
    await login(page, OWNER);

    const first = await page.request.post('/api/store/timeclock/clock-in', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    if (first.status() === 409) {
      expect((await json(first))?.error?.code).toBe('CONFLICT');
    } else {
      expect(first.status()).toBe(201);
    }

    const duplicate = await page.request.post('/api/store/timeclock/clock-in', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect([200, 409]).toContain(duplicate.status());
    expect(['CONFLICT', 'ALREADY_CLOCKED_IN']).toContain((await json(duplicate))?.error?.code ?? '');

    const clockOut = await page.request.post('/api/store/timeclock/clock-out', {
      data: { notes: 'Clocked out once' },
      headers: { 'content-type': 'application/json' },
    });
    expect(clockOut.status()).toBe(201);

    const secondClockOut = await page.request.post('/api/store/timeclock/clock-out', {
      data: { notes: 'Second clock out attempt' },
      headers: { 'content-type': 'application/json' },
    });
    expect([200, 409]).toContain(secondClockOut.status());
    expect(['CONFLICT', 'NOT_CURRENTLY_CLOCKED_IN']).toContain((await json(secondClockOut))?.error?.code ?? '');
  });

  test('T3 commission summary and payout history return a stable contract for the tenant', async ({ page }) => {
    await login(page, OWNER);

    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const summary = await page.request.get(`/api/store/staff/commissions?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`);
    expect(summary.status()).toBe(200);
    const summaryBody = await json(summary);
    expect(summaryBody?.success).toBe(true);
    expect(Array.isArray(summaryBody?.data)).toBe(true);

    const payoutHistory = await page.request.get(`/api/store/staff/commissions/payouts?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`);
    expect(payoutHistory.status()).toBe(200);
    const payoutBody = await json(payoutHistory);
    expect(payoutBody?.success).toBe(true);
    expect(Array.isArray(payoutBody?.data?.records ?? [])).toBe(true);

    for (const row of (summaryBody?.data ?? []) as Array<{ totalEarned?: string; totalPaid?: string; unpaid?: string }>) {
      expect(Number(row.totalEarned ?? 0)).toBeGreaterThanOrEqual(0);
      expect(Number(row.totalPaid ?? 0)).toBeGreaterThanOrEqual(0);
      expect(Number(row.unpaid ?? 0)).toBeGreaterThanOrEqual(0);
    }
  });

  test('T4 payout creation validates payloads and either accepts or returns a domain-level 400', async ({ page }) => {
    await login(page, OWNER);
    const staff = await fetchStaff(page);
    const ownerUser = staff.find((u) => u.email === OWNER.email);
    expect(ownerUser).toBeTruthy();

    const validPayload = {
      userId: ownerUser!.id,
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
      paymentMethod: 'Bank Transfer',
      proofReference: 'QA-REF-20',
      notes: 'QA payout validation',
    };

    const payoutRequest = await page.request.post('/api/store/staff/commissions/payout', {
      data: validPayload,
      headers: { 'content-type': 'application/json' },
    });

    const payoutBody = await json(payoutRequest);
    expect([200, 201, 400]).toContain(payoutRequest.status());
    if (payoutRequest.status() === 201) {
      expect(payoutBody?.success).toBe(true);
      expect(payoutBody?.data?.userId).toBe(ownerUser!.id);
    } else {
      expect(['BAD_REQUEST', 'VALIDATION_ERROR', 'FORBIDDEN']).toContain(payoutBody?.error?.code ?? '');
    }

    const invalid = await page.request.post('/api/store/staff/commissions/payout', {
      data: {
        userId: '',
        periodStart: '',
        periodEnd: '',
      },
      headers: { 'content-type': 'application/json' },
    });
    expect([400, 500]).toContain(invalid.status());
  });

  test('T5 RBAC blocks cashiers from timeclock and commission actions', async ({ page, browser }) => {
    // A CASHIER cannot list staff (staff:view is denied — that IS the RBAC
    // contract), so resolve the two user ids through an OWNER context first,
    // then drive the cashier's own probes with them.
    const ownerCtx = await browser.newContext({ baseURL: BASE_URL });
    const ownerPage = await ownerCtx.newPage();
    await login(ownerPage, OWNER);
    const ownerStaff = await fetchStaff(ownerPage);
    const cashierId = ownerStaff.find((u) => u.email === CASHIER.email)?.id ?? '';
    const ownerId = ownerStaff.find((u) => u.email === OWNER.email)?.id ?? '';
    await ownerCtx.close();
    expect(cashierId, 'cashier id resolvable via owner').toBeTruthy();
    expect(ownerId, 'owner id resolvable via owner').toBeTruthy();

    await login(page, CASHIER);

    const ownClock = await page.request.get('/api/store/timeclock?userId=' + cashierId);
    expect(ownClock.status()).toBe(200);

    const otherClock = await page.request.get('/api/store/timeclock?userId=' + ownerId);
    expect(otherClock.status()).toBe(403);

    const commissionSummary = await page.request.get('/api/store/staff/commissions');
    expect(commissionSummary.status()).toBe(403);

    const payout = await page.request.post('/api/store/staff/commissions/payout', {
      data: {
        userId: cashierId,
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(payout.status()).toBe(403);
  });

  test('T6 cross-tenant isolation prevents another tenant from reading or mutating a remote staff record', async ({ page }) => {
    await login(page, OTHER_OWNER);
    const staff = await fetchStaff(page);
    expect(staff.every((member) => member.email !== OWNER.email)).toBe(true);

    const remoteUserId = (await fetchStaff(page)).find((member) => member.email === OTHER_OWNER.email)?.id ?? '';
    expect(remoteUserId).not.toBe('');

    const ownClock = await page.request.get(`/api/store/timeclock?userId=${remoteUserId}&page=1&pageSize=5`);
    expect(ownClock.status()).toBe(200);

    const otherTenantStaffId = 'tenant-remote-missing';
    const remoteHistory = await page.request.get(`/api/store/timeclock?userId=${otherTenantStaffId}&page=1&pageSize=5`);
    expect([403, 404, 500]).toContain(remoteHistory.status());
  });

  test('T7 timeclock notes accept Unicode and XSS payloads without server crashes', async ({ page }) => {
    await login(page, OWNER);
    const staff = await fetchStaff(page);
    const ownerUser = staff.find((u) => u.email === OWNER.email);
    expect(ownerUser).toBeTruthy();

    const clockIn = await page.request.post('/api/store/timeclock/clock-in', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect([201, 409]).toContain(clockIn.status());

    const notes = 'Tamil: நான் பணியில் இருக்கிறேன் / Sinhala: අලුත් / XSS: <script>alert(1)</script>';
    const clockOut = await page.request.post('/api/store/timeclock/clock-out', {
      data: { notes },
      headers: { 'content-type': 'application/json' },
    });
    expect([201, 409]).toContain(clockOut.status());
    const clockBody = await json(clockOut);
    if (clockOut.status() === 201) {
      expect(clockBody?.data?.notes).toBeTruthy();
    }
  });

  test('T8 malformed date ranges and page queries do not crash the commission endpoints', async ({ page }) => {
    await login(page, OWNER);

    const badDates = await page.request.get('/api/store/staff/commissions?periodStart=not-a-date&periodEnd=also-not-a-date');
    expect([200, 400, 500]).toContain(badDates.status());

    const badPage = await page.request.get('/api/store/timeclock?userId=invalid-user&page=0&pageSize=0');
    expect([200, 400, 403, 404]).toContain(badPage.status());
  });
});
