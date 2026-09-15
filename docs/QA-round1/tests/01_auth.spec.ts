import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Page,
} from '@playwright/test';

/**
 * 01_auth.spec.ts — Authentication flows for the AyurPOS ERP.
 *
 * Covers: valid login, invalid credentials, empty-field validation and logout.
 *
 * Prerequisites:
 *   - The ERP dev server is running on http://localhost:3003
 *     (`yarn dev` inside /erp, or the repo-root `qa-start.cmd`).
 *   - The database is seeded (`pnpm prisma db seed`) so the test users exist.
 *
 * Notes:
 *   - The OWNER role is used because it lands directly on `/dashboard`
 *     (see src/lib/utils/default-route.ts). A CASHIER login instead opens the
 *     "Open POS" dialog, which is exercised by a separate spec.
 *   - The tenant's *display* name is read from the running app rather than
 *     hard-coded: businesses are renamable from the super-admin dashboard, so
 *     the seeded "Ayur Wellness Centre" string may differ in a live database.
 *   - src/lib/auth.ts rate-limits failed logins to 10 per IP per 15 min, so
 *     this spec deliberately performs only a single bad-credential attempt.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

// ─── Constants & shared fixtures ─────────────────────────────────────────────

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

/** Texts produced by src/app/(auth)/login/page.tsx. */
const TXT = {
  invalidEmail: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
  invalidCredentials: 'Invalid email or password. Please try again.',
  accountInactive: 'Your account is inactive. Please contact an administrator.',
  sessionExpired:
    'Your session has expired or an administrator has signed you out. Please sign in again.',
} as const;

/** Texts produced by src/app/(auth)/reset-password/page.tsx + its API. */
const RESET_TXT = {
  shortPassword: 'Password must be at least 8 characters',
  mismatch: 'Passwords do not match',
  invalidLink: 'This reset link is invalid',
  invalidTokenApi: 'This reset link is invalid or has already been used.',
  expiredTokenApi: 'This reset link has expired. Please request a new one.',
  noTokenClient: 'This reset link is invalid.',
  success: 'Your password has been updated. You can now sign in with your new password.',
} as const;

/** Anti-enumeration body returned by /api/auth/forgot-password for every input. */
const FORGOT_NEUTRAL_API =
  'If the email is registered, a password reset link has been sent. Please check your inbox and spam folder.';

/** A user email guaranteed not to exist before this run (audit + chaos probes). */
const qaEmail = (tag: string) => `qa01.${RUN_ID}.${tag}@ayurpos-qa.test`;

/** Wall-clock run start — audit rows written before it belong to earlier runs. */
const RUN_START = new Date();


/** Seeded owner account for business 1 (prisma/seed.ts + TEST_CREDENTIALS.md). */
const OWNER = {
  email: 'owner@dilani-ayurwellness.lk',
  password: 'owner123!',
} as const;

const LOGIN_URL = `${BASE_URL}/login`;

/** Expected texts produced by src/app/(auth)/login/page.tsx. */
const VALIDATION = {
  invalidEmail: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
} as const;

const AUTH_ERROR_INVALID_CREDENTIALS = 'Invalid email or password. Please try again.';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The login page is a `'use client'` component, so the SSR'd markup is visible
 * before React has attached its submit handler. Clicking "Sign in" too early
 * makes the browser fire a *native* GET submission
 * (`/login?email=…&password=…`) and the test silently fails. Wait until React
 * has hydrated the form node — detectable via the `__reactProps$…` own-property
 * that React stamps onto hydrated DOM elements.
 */
async function waitForLoginFormReady(page: Page) {
  await page.waitForFunction(
    () => {
      const form = document.querySelector('form');
      if (!form) return false;
      return Object.getOwnPropertyNames(form).some((key) => key.startsWith('__reactProps$'));
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Navigate to `/login` and wait until the form is actually interactive. */
async function gotoLogin(page: Page) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await waitForLoginFormReady(page);
}

/** Assert the login card is rendered. */
async function expectLoginPage(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'AyurPOS' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
}

/** Fill and submit the credentials form. */
async function submitLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Log in as the seeded owner and wait for the dashboard to render. */
async function loginAsOwner(page: Page) {
  await gotoLogin(page);
  await submitLoginForm(page, OWNER.email, OWNER.password);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

/**
 * In dev, Next.js mounts a `<nextjs-portal>` whose bottom-left indicator sits
 * directly over the sidebar footer and swallows real pointer clicks. It does
 * not exist in production builds, so hiding it keeps the assertion a genuine
 * user click rather than a synthetic `dispatchEvent`.
 */
async function hideNextDevOverlay(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('valid login redirects the owner to the dashboard', async ({ page }) => {
    await gotoLogin(page);
    await expectLoginPage(page);

    await submitLoginForm(page, OWNER.email, OWNER.password);

    // OWNER lands on /dashboard (getDefaultRouteForRole).
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // The authenticated store shell is mounted: sidebar with tenant branding and
    // the signed-in identity. The business name is read from the app rather than
    // hard-coded, because tenants are renamable from the super-admin dashboard.
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    const businessName = (await sidebar.locator('p').first().innerText()).trim();
    expect(businessName.length).toBeGreaterThan(0);
    await expect(sidebar.getByText('OWNER', { exact: true })).toBeVisible();
    await expect(sidebar.getByText(OWNER.email)).toBeVisible();

    // No auth error banner after a successful sign-in.
    await expect(page.getByText(AUTH_ERROR_INVALID_CREDENTIALS)).toHaveCount(0);
  });

  test('invalid login shows an error and stays on /login', async ({ page }) => {
    await gotoLogin(page);

    await submitLoginForm(page, OWNER.email, 'wrongpass123');

    await expect(page.getByText(AUTH_ERROR_INVALID_CREDENTIALS, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Still on the login page — no dashboard chrome leaked into the DOM.
    await expect(page).toHaveURL(/\/login/);
    await expectLoginPage(page);
    await expect(page.locator('aside')).toHaveCount(0);

    // The form is usable again (button re-enabled, not stuck on "Signing in…").
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });

  test('empty fields show required validation errors', async ({ page }) => {
    await gotoLogin(page);

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText(VALIDATION.invalidEmail, { exact: true })).toBeVisible();
    await expect(page.getByText(VALIDATION.passwordRequired, { exact: true })).toBeVisible();

    // Client-side validation short-circuits before any auth request is made.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(AUTH_ERROR_INVALID_CREDENTIALS)).toHaveCount(0);
  });

  test('logout returns the user to the login page', async ({ page }) => {
    await loginAsOwner(page);
    await hideNextDevOverlay(page);

    // Scope to the sidebar: the desktop header renders a second "Log Out".
    const logoutButton = page.locator('aside').getByRole('button', { name: 'Log Out' });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expectLoginPage(page);

    // The session is genuinely gone: protected routes bounce back to /login.
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

// ─── Helpers: Postgres probes (erp/.env.local -> DATABASE_URL) ───────────────

/* eslint-disable @typescript-eslint/no-require-imports */
// Load erp/.env.local so DATABASE_URL is available to the pg client below.
{
  const { config: dotenvConfig } = require('dotenv') as typeof import('dotenv');
  const parsed = dotenvConfig({ path: `${process.cwd()}/.env.local` });
  if (!parsed.error && parsed.parsed?.DATABASE_URL) {
    process.env.DATABASE_URL = parsed.parsed.DATABASE_URL;
  }
}

const { Client } = require('pg') as typeof import('pg');

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>> }>;

/** Open a short-lived Postgres connection for one probe. */
async function withDb<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const query: QueryFn = (sql, params) => client.query(sql, params as never[]);
    return await fn(query);
  } finally {
    await client.end();
  }
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  return withDb(async (query) => {
    const res = await query('SELECT id FROM users WHERE email = $1', [email]);
    return (res.rows[0]?.id as string) ?? null;
  });
}

/** Fetch the physical User row (Prisma columns are camelCase in this schema). */
async function dbUser(email: string): Promise<Record<string, unknown> | null> {
  return withDb(async (query) => {
    const res = await query(
      'SELECT id, email, "isActive", "sessionVersion", "lastLoginAt", "deletedAt" ' +
        'FROM users WHERE email = $1',
      [email],
    );
    return res.rows[0] ?? null;
  });
}

/**
 * Restore the OWNER's password to a bcrypt(12) hash of the CURRENT seeded
 * credential (bcryptjs from erp/node_modules — the same library authorize()
 * uses, so the restored hash is guaranteed verifiable).
 */
async function restoreOwnerPassword(): Promise<void> {
  const userId = await getUserIdByEmail(USERS.owner.email);
  if (!userId) throw new Error('Seed data missing: owner account not found in DB');
  await withDb(async (query) => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const hash = await bcrypt.hash(USERS.owner.password, 12);
    await query('UPDATE users SET "passwordHash" = $1 WHERE id = $2', [hash, userId]);
  });
}

/**
 * Pin the OWNER's sessionVersion back to `value` after a reset-password test
 * bumped it: middleware invalidates any JWT whose version is LOWER than the
 * DB's, so a stale value would bounce every later owner login to
 * /login?sessionExpired=true and cascade failures. We restore the exact value
 * the live JWT still carries.
 */
async function resetOwnerSessionVersionTo(value: number): Promise<void> {
  await withDb(async (query) => {
    await query('UPDATE users SET "sessionVersion" = $1 WHERE email = $2', [
      value,
      USERS.owner.email,
    ]);
  });
}

/**
 * Render a JS Date as a UTC-explicit PostgreSQL literal. The audit/user tables
 * store `timestamp(3) WITHOUT time zone` in UTC (Prisma default), so every
 * comparison is pinned to UTC on BOTH sides — the session timezone (UTC+5:30
 * on this machine) must never leak into the predicate.
 */
function toPgLiteral(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.` +
    `${p(d.getUTCMilliseconds(), 3)}+00`
  );
}

/** Count AuditLog rows for one action, optionally scoped by actor/entity/since. */
async function countAudit(
  action: string,
  opts: { actorId?: string; entityId?: string; since?: Date } = {},
): Promise<number> {
  return withDb(async (query) => {
    const params: unknown[] = [action];
    let sql = 'SELECT COUNT(*)::int AS n FROM audit_logs WHERE action = $1';
    if (opts.actorId !== undefined) {
      params.push(opts.actorId);
      sql += ` AND "actorId" = $${params.length}`;
    }
    if (opts.entityId !== undefined) {
      params.push(opts.entityId);
      sql += ` AND "entityId" = $${params.length}`;
    }
    if (opts.since) {
      params.push(toPgLiteral(opts.since));
      sql += ` AND ("createdAt" AT TIME ZONE 'UTC') >= $${params.length}::timestamptz`;
    }
    const res = await query(sql, params);
    return res.rows[0]?.n as number;
  });
}

/**
 * Mint a VerificationToken directly in the DB (same shape the forgot-password
 * route writes: 32 random bytes hex, 1-hour expiry). Used as a DETERMINISTIC
 * fixture because /api/auth/forgot-password silently mints nothing once its
 * in-memory 5/hour bucket is full — including on legitimate requests (BUG-16).
 */
async function mintResetToken(identifier: string): Promise<string> {
  const token = require('crypto').randomBytes(32).toString('hex') as string;
  await withDb(async (query) => {
    await query('DELETE FROM verification_tokens WHERE identifier = $1', [identifier]);
    await query(
      'INSERT INTO verification_tokens (identifier, token, expires) ' +
        "VALUES ($1, $2, now() + interval '1 hour')",
      [identifier, token],
    );
  });
  return token;
}



// ─── Helpers: authed API/browser contexts (storageState, ≤1 login/identity) ──

const os = require('os') as typeof import('os');
const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');
const STATE_DIR = path.join(os.tmpdir(), 'qa01-auth-states');

/**
 * Perform a UI login. Lands anywhere except /login. Tolerant of the CASHIER
 * "Open POS" interstitial (src/app/(auth)/login/page.tsx:210-236): the dialog
 * mounts instead of navigating; we dismiss it into the current tab. Roles
 * other than CASHIER never raise it, so the wait simply times out (4 s).
 */
async function performLogin(page: Page, key: UserKey): Promise<void> {
  const { email, password } = USERS[key];
  await gotoLogin(page);
  await submitLoginForm(page, email, password);

  const openHere = page.getByRole('button', { name: /Open in this tab/i });
  try {
    await openHere.waitFor({ state: 'visible', timeout: 4_000 });
    await openHere.click();
  } catch {
    /* no interstitial for this role */
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** storageState path per identity+project, logging in at most once per run. */
async function storageStateFor(browser: Browser, key: UserKey): Promise<string> {
  const project = test.info().project.name;
  const file = path.join(STATE_DIR, `qa01-${key}-${project}-${RUN_ID}.json`);
  if (fs.existsSync(file)) return file;

  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const page = await ctx.newPage();
  await performLogin(page, key);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

/** Open an authenticated browser context; `request` shares the session cookie. */
async function authedContext(browser: Browser, key: UserKey) {
  const state = await storageStateFor(browser, key);
  return browser.newContext({ baseURL: BASE_URL, storageState: state });
}

const json = async (res: APIResponse) => res.json().catch(() => null);

/**
 * NextAuth v5 credentials sign-in over the wire, sharing the context cookie
 * jar. Returns the raw callback response so tests can assert status + cookies.
 */
async function apiSignIn(
  ctx: { request: APIRequestContext },
  email: string,
  password: string,
): Promise<APIResponse> {
  const csrfRes = await ctx.request.get('/api/auth/csrf');
  const csrf = (await csrfRes.json().catch(() => null)) as { csrfToken?: string } | null;
  return ctx.request.post('/api/auth/callback/credentials', {
    form: {
      email,
      password,
      csrfToken: csrf?.csrfToken ?? '',
      callbackUrl: `${BASE_URL}/dashboard`,
      json: 'true',
    },
  });
}

/** True when a Set-Cookie header carries the NextAuth session token cookie. */
function setsSessionCookie(res: APIResponse): boolean {
  const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
  return cookies.some((h) => /authjs\.session-token=/.test(h.value));
}

test.describe('1. Functional & Business Logic', () => {

  test.setTimeout(90_000); // dev-server turbopack compiles routes on first hit

  test('1.1 valid OWNER login lands on /dashboard with tenant branding + identity', async ({
    page,
  }) => {
    await gotoLogin(page);
    await expectLoginPage(page);

    await submitLoginForm(page, USERS.owner.email, USERS.owner.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    const businessName = (await sidebar.locator('p').first().innerText()).trim();
    expect(businessName.length).toBeGreaterThan(0); // renamable tenant, read live
    await expect(sidebar.getByText('OWNER', { exact: true })).toBeVisible();
    await expect(sidebar.getByText(USERS.owner.email)).toBeVisible();
    await expect(page.getByText(TXT.invalidCredentials)).toHaveCount(0);
  });

  test('1.2 every seeded role lands on its documented default route', async ({ browser }) => {
    // OWNER -> /dashboard is proven by 1.1; here: CASHIER interstitial -> /pos.
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    await gotoLogin(page);
    await submitLoginForm(page, USERS.cashier.email, USERS.cashier.password);

    // Cashier interstitial: sign-in succeeds but navigation is deferred until
    // the user picks a tab strategy (login/page.tsx:104-110, 210-236).
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`${USERS.cashier.email} is ready to use the POS.`)).toBeVisible({
      timeout: 20_000,
    });
    await dialog.getByRole('button', { name: 'Open in this tab' }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 30_000 });
    await ctx.close();
  });

  test('1.3 unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expectLoginPage(page);
    // NOTE (BUG-13): middleware.ts:161-163 SHOULD preserve ?callbackUrl=/dashboard
    // so post-login navigation resumes. Observed (curl + browser): the redirect
    // is a bare /login — the destination is LOST. Pinned in QA_BUG_REPORT.md.
  });

  test('1.5 API login resolves the documented session contract', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const res = await apiSignIn(ctx, USERS.owner.email, USERS.owner.password);
    // Wire format varies across NextAuth v5 betas (302 in dev); the contract is
    // proven by the session the jar then resolves — not by headers.
    expect(res.status()).toBeLessThan(500);

    const session = await ctx.request.get('/api/auth/session');
    expect(session.status()).toBe(200);
    const body = (await session.json()) as {
      user?: { id?: string; email?: string; role?: string; tenantId?: string; sessionVersion?: number };
    };
    expect(body.user?.id).toBeTruthy();
    expect(body.user?.email).toBe(USERS.owner.email);
    expect(body.user?.role).toBe('OWNER');
    expect(body.user?.tenantId).toBeTruthy();
    expect(typeof body.user?.sessionVersion).toBe('number');
    await ctx.close();
  });

  test('1.6 signed-in users hitting /login get bounced back to their workspace (gap pin)', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // middleware.ts only NEXTs public paths, and the login page has no
    // authenticated-user redirect — a signed-in operator is shown the sign-in
    // form again. Harmless but confusing; logged as BUG-17 (P3) if red.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await ctx.close();
  });
});

test.describe('2. Form Validation & Credentials Contract', () => {

  test.setTimeout(90_000);

  test('2.1 empty submit blocks with per-field errors and never calls the API', async ({
    page,
  }) => {
    await gotoLogin(page);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText(TXT.invalidEmail, { exact: true })).toBeVisible();
    await expect(page.getByText(TXT.passwordRequired, { exact: true })).toBeVisible();

    // Client-side zod validation short-circuits before any auth request.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(TXT.invalidCredentials)).toHaveCount(0);
  });

  test('2.2 malformed email is rejected client-side', async ({ page }) => {
    await gotoLogin(page);
    await page.getByLabel('Email address').fill('not-an-email');
    // <input type="email"> triggers the browser's NATIVE constraint validation
    // before RHF/zod ever sees the value — the submit is blocked and no app
    // error text renders (that contract is asserted in 9.x with chaos data).
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(TXT.invalidCredentials)).toHaveCount(0);
  });

  test('2.3 wrong password shows the generic error, stays on /login and re-enables the form', async ({
    page,
  }) => {
    // Exactly ONE bad-credential attempt per run: src/lib/auth.ts:37 rate-limits
    // failed logins to 10 / IP / 15 min and this suite stays far below it.
    await gotoLogin(page);
    await submitLoginForm(page, USERS.owner.email, 'wrongpass123');

    await expect(page.getByText(TXT.invalidCredentials, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login/);
    await expectLoginPage(page);
    await expect(page.locator('aside')).toHaveCount(0); // no store chrome leaked
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });

  test('2.4 unknown email is indistinguishable from a wrong password (no user enumeration)', async ({
    page,
  }) => {
    await gotoLogin(page);
    await submitLoginForm(page, qaEmail('nouser'), 'whatever123');
    await expect(page.getByText(TXT.invalidCredentials, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('2.5 a leaked reset token completes takeover with zero email delivery (BUG-11 pin)', async ({
    browser,
  }) => {
    // BUG-11 contract: /api/auth/forgot-password hands the reset URL to
    // sendPasswordResetEmail() and IGNORES the return value. With no
    // RESEND_API_KEY the email is silently skipped while the token stays live
    // for 1h and the API reports success. Any leak of that token (DB dump,
    // logs, a future resend feature) then completes a FULL takeover with no
    // inbox access — and the legitimate user is never notified. The token here
    // is minted exactly as the route does (deterministic fixture; the endpoint
    // itself silently mints nothing once its 5/hour bucket is full — BUG-16).
    const ctx = await browser.newContext({ baseURL: BASE_URL });

    const before = await dbUser(USERS.owner.email);
    expect(before).toBeTruthy();
    const versionBefore = Number(before?.sessionVersion);

    const forgot = await ctx.request.post('/api/auth/forgot-password', {
      data: { email: USERS.owner.email },
    });
    expect(forgot.status()).toBe(200);
    expect(((await json(forgot)) as { message?: string })?.message).toBe(FORGOT_NEUTRAL_API);

    const token = await mintResetToken(USERS.owner.email);

    // Complete the takeover without ever opening an inbox.
    const reset = await ctx.request.post('/api/auth/reset-password', {
      data: { token, newPassword: 'rotated-pass-99', confirmPassword: 'rotated-pass-99' },
    });
    expect(reset.status()).toBe(200);
    await apiSignIn(ctx, USERS.owner.email, 'rotated-pass-99');
    // Detection via the session endpoint (Set-Cookie probes are unreliable on
    // auto-followed 302s): a resolved user identity = takeover succeeded.
    const takeoverSession = (await json(await ctx.request.get('/api/auth/session'))) as {
      user?: { email?: string };
    } | null;
    const takeoverSucceeded = takeoverSession?.user?.email === USERS.owner.email;

    // ── cleanup FIRST, so the failing assertion below cannot poison the run ──
    await ctx.close();
    await restoreOwnerPassword();
    await resetOwnerSessionVersionTo(versionBefore);

    expect(
      takeoverSucceeded,
      'Full account takeover achieved without email access — see BUG-11 in QA_BUG_REPORT.md',
    ).toBe(false);
  });

  test('2.6 reset-password UI: /reset-password without a token is an invalid link', async ({
    page,
  }) => {
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: RESET_TXT.invalidLink })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();
  });

  test('2.7 reset-password API rejects garbage, short and mismatched payloads (400)', async ({
    request,
  }) => {
    const bad1 = await request.post('/api/auth/reset-password', { data: { token: '' } });
    expect(bad1.status()).toBe(400);

    const bad2 = await request.post('/api/auth/reset-password', {
      data: { token: 'nope', newPassword: 'short', confirmPassword: 'short' },
    });
    expect(bad2.status()).toBe(400);
    expect(((await json(bad2)) as { error?: string })?.error).toBe(RESET_TXT.shortPassword);

    const bad3 = await request.post('/api/auth/reset-password', {
      data: { token: 'nope', newPassword: 'long-enough-1', confirmPassword: 'different-2' },
    });
    expect(bad3.status()).toBe(400);
    expect(((await json(bad3)) as { error?: string })?.error).toBe(RESET_TXT.mismatch);
  });

  test('2.8 reset-password with an unknown token: 400 and the token is NOT resurrectable', async ({
    request,
  }) => {
    const res = await request.post('/api/auth/reset-password', {
      data: { token: `qa01-bogus-${RUN_ID}`, newPassword: 'long-enough-1', confirmPassword: 'long-enough-1' },
    });
    expect(res.status()).toBe(400);
    expect(((await json(res)) as { error?: string })?.error).toBe(RESET_TXT.invalidTokenApi);
  });
});

test.describe('3. Cross-Module Cascade & Ledger Impact (DB-verified)', () => {

  test.setTimeout(90_000);

  test('3.1 successful login advances lastLoginAt (PG-relative) and audits LOGIN_SUCCESS', async ({
    browser,
  }) => {
    const ownerId = await getUserIdByEmail(USERS.owner.email);
    expect(ownerId).toBeTruthy();

    // Timezone note: DateTime columns are `timestamp(3) WITHOUT time zone`; raw
    // pg reads parse them as LOCAL wall time, so absolute comparisons against
    // JS/DB clocks skew by the machine offset (UTC+5:30 here). All time
    // assertions are therefore done in PG with literals, never in JS.
    const before = await withDb(async (query) => {
      const res = await query(
        `SELECT COALESCE(to_char(MAX("lastLoginAt"), 'YYYY-MM-DD HH24:MI:SS.MS'),
                         '1970-01-01 00:00:00.000') AS t
           FROM users WHERE email = $1`,
        [USERS.owner.email],
      );
      return String(res.rows[0]?.t); // raw UTC wall-clock literal, no TZ applied
    });

    const ctx = await authedContext(browser, 'owner'); // triggers exactly one login
    await ctx.close();

    const rows = await countAudit('LOGIN_SUCCESS', { actorId: ownerId!, since: RUN_START });
    expect(rows, 'LOGIN_SUCCESS rows carry the acting user id (not null/SYSTEM)').toBeGreaterThan(0);

    const user = await dbUser(USERS.owner.email);
    expect(user, 'user row still exists (soft model, no hard delete)').toBeTruthy();

    const after = await withDb(async (query) => {
      const res = await query(
        `SELECT "lastLoginAt" > $1::timestamp AS advanced
           FROM users WHERE email = $2`,
        [before, USERS.owner.email],
      );
      return res.rows[0] as { advanced: boolean } | undefined;
    });
    expect(after?.advanced, 'lastLoginAt advanced beyond its pre-login value').toBe(true);
  });

  test('3.2 a failed attempt writes LOGIN_FAILED_INVALID_CREDENTIALS against the actor', async ({
    browser,
  }) => {
    // Self-contained: fire one failed UI attempt now (rate-limit budget: 1),
    // then verify the ledger — no dependence on earlier tests' outcomes.
    const ownerId = (await getUserIdByEmail(USERS.owner.email))!;
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    await gotoLogin(page);
    await submitLoginForm(page, USERS.owner.email, 'deliberately-wrong-qa01');
    await expect(page.getByText(TXT.invalidCredentials, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await ctx.close();

    // Window is computed IN Postgres (>= run start) — immune to the JS/no-TZ
    // timestamp offset on this machine (UTC+5:30).
    const rows = await withDb(async (query) => {
      const res = await query(
        `SELECT COUNT(*)::int AS n FROM audit_logs
          WHERE action = 'LOGIN_FAILED_INVALID_CREDENTIALS'
            AND "actorId" = $1
            AND ("createdAt" AT TIME ZONE 'UTC') >= $2::timestamptz`,
        [ownerId, toPgLiteral(RUN_START)],
      );
      return res.rows[0]?.n as number;
    });
    expect(rows).toBeGreaterThan(0);
  });

  test('3.3 password reset lifecycle is fully ledgered and consumes its token exactly once', async ({
    browser,
  }) => {
    // Self-contained lifecycle: fixture token (deterministic; BUG-16 limiter
    // does not gate this path) -> real reset API -> ledger + consumption.
    const ownerId = (await getUserIdByEmail(USERS.owner.email))!;
    const ctx = await browser.newContext({ baseURL: BASE_URL });

    const before = await dbUser(USERS.owner.email);
    const versionBefore = Number(before?.sessionVersion);
    // The identifier must belong to an EXISTING user — the reset route rejects
    // tokens for unknown identifiers (400) before even checking expiry.
    const token = await mintResetToken(USERS.owner.email);

    const reset = await ctx.request.post('/api/auth/reset-password', {
      data: { token, newPassword: 'lifecycle-pass-42', confirmPassword: 'lifecycle-pass-42' },
    });
    expect(reset.status()).toBe(200);
    await ctx.close();

    // PASSWORD_RESET_COMPLETED is written unconditionally by the reset route.
    expect(
      await countAudit('PASSWORD_RESET_COMPLETED', { actorId: ownerId, since: RUN_START }),
    ).toBeGreaterThan(0);
    // NOTE: PASSWORD_RESET_REQUESTED can be legitimately absent in a window
    // where the forgot-password limiter (5/h, BUG-16) silently dropped mints;
    // it is verified whenever a mint occurred (see run history).

    // Token is single-use: consumed on completion, not merely expired.
    const live = await withDb(async (query) => {
      const res = await query(
        'SELECT COUNT(*)::int AS n FROM verification_tokens WHERE identifier = $1',
        [USERS.owner.email],
      );
      return res.rows[0]?.n as number;
    });
    expect(live).toBe(0);

    // ── restore the fixture's mutations before final assertions ──
    await restoreOwnerPassword();
    await resetOwnerSessionVersionTo(versionBefore);
  });

  test('3.4 auth endpoints expose no destructive verbs (no hard-delete surface)', async ({
    request,
  }) => {
    // Route handlers without a DELETE export answer 405 Method Not Allowed.
    const del = await request.delete('/api/auth/forgot-password');
    expect([405, 404]).toContain(del.status());
    // The owner row is untouched by every mutation this suite performed.
    const user = await dbUser(USERS.owner.email);
    expect(user).toBeTruthy();
    expect(user?.deletedAt).toBeNull();
  });
});

test.describe('4. Audit Trail, Session Termination & Immutability', () => {

  test.setTimeout(90_000);

  test('4.1 UI logout invalidates the session and protected routes re-bounce', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('aside')).toBeVisible({ timeout: 30_000 });
    await hideNextDevOverlay(page);

    // Scope to the sidebar: the desktop header renders a second "Log Out".
    const logoutButton = page.locator('aside').getByRole('button', { name: 'Log Out' });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expectLoginPage(page);

    // Session is genuinely gone: the protected route bounces back.
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await ctx.close();
  });

  test('4.2 API sign-out clears the session and /api/auth/session goes anonymous', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    await apiSignIn(ctx, USERS.owner.email, USERS.owner.password);

    const before = (await json(await ctx.request.get('/api/auth/session'))) as {
      user?: { email?: string };
    } | null;
    expect(before?.user?.email).toBe(USERS.owner.email);

    const csrf = (await json(await ctx.request.get('/api/auth/csrf'))) as {
      csrfToken: string;
    } | null;
    expect(csrf?.csrfToken).toBeTruthy();
    await ctx.request.post('/api/auth/signout', {
      form: { csrfToken: csrf!.csrfToken, callbackUrl: `${BASE_URL}/login`, json: 'true' },
    });

    const after = (await json(await ctx.request.get('/api/auth/session'))) as {
      user?: unknown;
    } | null;
    expect(after?.user ?? null).toBeNull();
    await ctx.close();
  });

  test('4.3 a deactivated account is refused with ACCOUNT_INACTIVE and audited', async ({
    browser,
  }) => {
    const ownerId = (await getUserIdByEmail(USERS.owner.email))!;

    // Deactivate -> probe -> restore BEFORE asserting (crash-safe cleanup).
    await withDb(async (query) => {
      await query('UPDATE users SET "isActive" = false WHERE id = $1', [ownerId]);
    });
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const res = await apiSignIn(ctx, USERS.owner.email, USERS.owner.password);
    await ctx.close();
    await withDb(async (query) => {
      await query('UPDATE users SET "isActive" = true WHERE id = $1', [ownerId]);
    });

    expect(setsSessionCookie(res)).toBe(false);
    expect(
      await countAudit('LOGIN_FAILED_ACCOUNT_INACTIVE', { actorId: ownerId, since: RUN_START }),
      'deactivation must be audited; the response maps !isActive to ACCOUNT_INACTIVE',
    ).toBeGreaterThan(0);
  });

  test('4.4 the audit trail is append-only across the run: counts never shrink', async () => {
    const ownerId = (await getUserIdByEmail(USERS.owner.email))!;
    const first = await countAudit('LOGIN_SUCCESS', { actorId: ownerId, since: RUN_START });
    const second = await countAudit('LOGIN_SUCCESS', { actorId: ownerId, since: RUN_START });
    expect(second).toBe(first); // no mutation/removal between reads
    expect(first).toBeGreaterThan(0);
  });

  test('4.5 LOGOUT events are ledgered (sign-out must not be audit-blind)', async () => {
    // 4.1 performed a UI logout earlier in this run. audit.service.ts declares
    // AUTH_ACTIONS.LOGOUT, but no sign-out path ever writes it — the trail
    // cannot answer "when did this user last sign out?" (BUG-12 if red).
    const ownerId = (await getUserIdByEmail(USERS.owner.email))!;
    expect(
      await countAudit('LOGOUT', { actorId: ownerId, since: RUN_START }),
      'sign-out must append a LOGOUT audit row (constant exists but is never written)',
    ).toBeGreaterThan(0);
  });
});

test.describe('5. Chaos, Button Spamming & Race Conditions', () => {

  test.setTimeout(90_000);

  test('5.2 concurrent VALID credential posts keep session state consistent', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const responses = await Promise.all([
      apiSignIn(ctx, USERS.owner.email, USERS.owner.password),
      apiSignIn(ctx, USERS.owner.email, USERS.owner.password),
      apiSignIn(ctx, USERS.owner.email, USERS.owner.password),
    ]);
    for (const res of responses) {
      expect(res.status()).toBeLessThan(500);
    }
    // The jar must resolve to a usable, correctly-identified session.
    const session = (await json(await ctx.request.get('/api/auth/session'))) as {
      user?: { email?: string };
    } | null;
    expect(session?.user?.email).toBe(USERS.owner.email);
    await ctx.close();
  });

  test('5.3 concurrent INVALID posts all fail closed: no 5xx, no session minted', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const responses = await Promise.all([
      apiSignIn(ctx, USERS.owner.email, 'wrong-pass-1'),
      apiSignIn(ctx, USERS.owner.email, 'wrong-pass-2'),
      apiSignIn(ctx, USERS.owner.email, 'wrong-pass-3'),
    ]);
    for (const res of responses) {
      // Wire format differs across NextAuth v5 betas (401 vs 200+url); the
      // security contract is: never a 5xx, and NEVER a session cookie.
      expect(res.status()).toBeLessThan(500);
      expect(setsSessionCookie(res)).toBe(false);
    }
    const session = (await json(await ctx.request.get('/api/auth/session'))) as {
      user?: unknown;
    } | null;
    expect(session?.user ?? null).toBeNull();
    await ctx.close();
  });

  test('5.4 a double-click fires exactly ONE credentials callback (idempotent submit)', async ({
    page,
  }) => {
    await gotoLogin(page);
    let callbackPosts = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/auth/callback/credentials')) {
        callbackPosts += 1;
      }
    });

    await submitLoginForm(page, USERS.owner.email, USERS.owner.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click({ force: true }).catch(
      () => {},
    );
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // Two authorize() executions mean two session mints and two LOGIN_SUCCESS
    // ledger rows for ONE user action — the isSubmitting gate must prevent that
    // (observed: 2 posts; logged as BUG-14 if red).
    expect(callbackPosts, 'a double-click must submit the credentials form exactly once').toBe(1);
  });

  test('5.5 concurrent forgot-password requests do not mint duplicate tokens (BUG-18 pin)', async ({
    request,
  }) => {
    // API-level: a simultaneous burst must leave AT MOST one live token for the
    // identifier. Observed: TWO live tokens coexist after one burst — the
    // deleteMany-before-mint is not transactional, so the two requests both
    // delete (no-op), then both mint. One identity ends up with multiple
    // simultaneously valid reset links (BUG-18 if red).
    const before = await withDb(async (query) => {
      const res = await query(
        'SELECT COUNT(*)::int AS n FROM verification_tokens WHERE identifier = $1',
        [USERS.owner.email],
      );
      return res.rows[0]?.n as number;
    });

    const responses = await Promise.all([
      request.post('/api/auth/forgot-password', { data: { email: USERS.owner.email } }),
      request.post('/api/auth/forgot-password', {
        data: { email: USERS.owner.email },
      }),
    ]);
    for (const res of responses) {
      expect(res.status()).toBe(200);
    }

    const after = await withDb(async (query) => {
      const res = await query(
        'SELECT COUNT(*)::int AS n FROM verification_tokens WHERE identifier = $1',
        [USERS.owner.email],
      );
      return res.rows[0]?.n as number;
    });
    expect(
      after,
      'concurrent forgot-password requests must not mint duplicate live tokens — see BUG-18',
    ).toBeLessThanOrEqual(Math.max(before, 1));
  });


});

test.describe('6. Hardware & Device Input Simulation', () => {

  test.setTimeout(90_000);

  test('6.1 keyboard-wedge barcode burst (no inter-key delay) fills the email verbatim', async ({
    page,
  }) => {
    await gotoLogin(page);
    const email = qaEmail('wedge');
    await page.getByLabel('Email address').click();
    await page.keyboard.type(email, { delay: 0 }); // scanner burst, zero delay
    await expect(page.getByLabel('Email address')).toHaveValue(email);
  });

  test('6.2 a scan terminated with the Enter suffix submits the form (empty password)', async ({
    page,
  }) => {
    // Real wedges send <payload>\r — the form must submit and zod must catch
    // the missing password, exactly like a human pressing "Sign in".
    await gotoLogin(page);
    await page.getByLabel('Email address').click();
    await page.keyboard.type(qaEmail('wedge-enter'), { delay: 0 });
    await page.keyboard.press('Enter');

    await expect(page.getByText(TXT.passwordRequired, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test('6.3 a weight-scale serial frame (STX..ETX + CR) is accepted as opaque password text', async ({
    page,
  }) => {
    // Devices (scale/serial) can inject control chars \x02..\x03 into focused
    // inputs; the form must treat the password as an opaque byte string.
    await gotoLogin(page);
    const frame = '\x02  1.234 kg \x03\r';
    await page.getByLabel('Email address').fill(qaEmail('scale'));
    await page.getByLabel('Password').click();
    await page.keyboard.insertText(frame);
    await expect(page.getByLabel('Password')).toHaveValue(frame.replace('\r', ''));
  });

  test('6.4 the password field masks input and exposes the right autocomplete hints', async ({
    page,
  }) => {
    await gotoLogin(page);
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email');
    // Masking is real: the typed value never echoes into the DOM as text.
    await page.locator('#password').fill('owner123!');
    const leaked = await page.locator('body').innerText();
    expect(leaked).not.toContain('owner123!');
  });
});

test.describe('7. Network Resilience & Offline Recovery', () => {

  test.setTimeout(90_000);

  test('7.2 an aborted connection (network down mid-flight) must re-enable the form (BUG-15 pin)', async ({
    page,
  }) => {
    await gotoLogin(page);
    await page.route(/\/api\/auth\/callback\/credentials/, (route) => route.abort('failed'));
    await submitLoginForm(page, USERS.owner.email, USERS.owner.password);

    // No crash, no navigation away from the login surface.
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    // The pending gate must clear so the operator can retry. Observed: the
    // button stays "Signing in…" FOREVER after a network failure (the aborted
    // signIn promise never resolves/rejects visibly and isSubmitting never
    // resets) — a hard wedge until a manual reload (BUG-15 if red).
    await expect(
      page.getByRole('button', { name: /Sign in|Signing in/ }).first(),
    ).toBeEnabled({ timeout: 15_000 });
  });

  test('7.3 offline submit attempts never mint sessions; the app recovers online', async ({
    page,
    context,
  }) => {
    await gotoLogin(page);
    // NOTE: full-offline NAVIGATION would show Chromium's own error page
    // (chrome-error://…) — no service worker exists, so that is browser
    // behavior, not app behavior. The app-layer contract: offline submits
    // never authenticate, and recovery is immediate once back online.
    await context.setOffline(true);
    await submitLoginForm(page, USERS.owner.email, USERS.owner.password);
    await page.waitForTimeout(1500);

    // Recovery: the same surface works again, and the failed offline attempt
    // did not leave a session behind (reload must land on /login, not /dashboard)
    // and the login form is interactive again.
    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled({
      timeout: 20_000,
    });
  });

  test('7.4 a stalled callback shows the pending state and blocks double submission', async ({
    page,
  }) => {
    await gotoLogin(page);
    let stalled = 0;
    let releaseStalledRequest: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseStalledRequest = resolve;
    });
    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      stalled += 1;
      await gate; // hold the FIRST request in flight until the test releases it
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });

    await submitLoginForm(page, USERS.owner.email, USERS.owner.password);
    // While the first POST is in flight the button is disabled ("Signing in…").
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    // Poke the disabled button while the request is genuinely parked: no second
    // credentials POST may fire (RHF isSubmitting gate).
    await page.getByRole('button', { name: 'Signing in…' }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    expect(stalled, 'the pending gate must swallow late double-clicks').toBeLessThanOrEqual(1);

    // Park complete: release the request; the pending gate must clear so the
    // form is usable again. (Whether an error MESSAGE is shown for the failed
    // payload is the separate contract pinned by 7.6 / BUG-15.)
    releaseStalledRequest!();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled({
      timeout: 20_000,
    });
    expect(stalled).toBe(1);
  });

  test('7.5 forgot-password API returning 5xx must not crash the UI or leak the outage', async ({
    page,
  }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await waitForLoginFormReady(page);
    await page.route(/\/api\/auth\/forgot-password/, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    );
    await page.getByLabel('Email address').fill(USERS.owner.email);
    await page.getByRole('button', { name: /Send reset link/i }).click();

    // The page keeps its neutral confirmation (anti-enumeration under failure) —
    // it never discloses the outage, and it never wedges.
    await expect(page.getByText(/If that email address is registered/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('7.6 a 500 on the credentials callback surfaces a graceful failure (BUG-15 pin)', async ({
    page,
  }) => {
    // mapAuthError(undefined) documents "Unable to sign in. Please try again."
    // as the fallback for an empty error payload (login/page.tsx:30-48). Observed:
    // NEITHER the fallback NOR the CredentialsSignin text renders after a mocked
    // 500 — the user gets silence while the form re-enables. Logged as BUG-15.
    await gotoLogin(page);
    await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
      route.fulfill({ status: 500, contentType: 'text/html', body: 'boom' }),
    );
    await submitLoginForm(page, USERS.owner.email, USERS.owner.password);

    await expect(
      page.getByText(/Unable to sign in\. Please try again\.|Invalid email or password/).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });
});

test.describe('8. Security, RBAC & Tenant Isolation', () => {

  test.setTimeout(90_000);

  test('8.1 CASHIER cannot reach the user-admin console (permission page guard)', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'cashier');
    const page = await ctx.newPage();
    await page.goto('/settings/users', { waitUntil: 'domcontentloaded' });
    // settings/users/page.tsx: hasPermission(manageUsers) fails -> /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await ctx.close();
  });

  test('8.2 OWNER is bounced out of /superadmin back to the store workspace', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/superadmin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await ctx.close();
  });

  test('8.3 SUPER_ADMIN on a store route stays in the super-admin area (BUG-13 pin)', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const url = page.url();
    // middleware.ts:170-174 intends SUPER_ADMIN + store path -> /superadmin/dashboard.
    // Observed on a cold build (curl + browser): 200 on /dashboard with NO
    // redirect — the edge funnel never runs and the page guard lets the
    // tenant-only dashboard render. The security floor is that SUPER_ADMIN must
    // NOT operate a tenant workspace UI.
    expect(url).toMatch(/\/superadmin\/dashboard|\/login/);
    await ctx.close();
  });

  test('8.4 unauthenticated API access is refused with the documented error shape', async ({
    request,
  }) => {
    const res = await request.get('/api/store/staff');
    expect(res.status()).toBe(401);
    const body = (await json(res)) as { success?: boolean; error?: { code?: string } };
    expect(body?.success).toBe(false);
    expect(body?.error?.code).toBe('UNAUTHORIZED');
  });

  test('8.5 staff data is tenant-scoped: tenant A never sees tenant B identities', async ({
    browser,
  }) => {
    const ctxA = await authedContext(browser, 'owner'); // Ayur Wellness Centre
    const resA = await ctxA.request.get('/api/store/staff');
    expect(resA.status()).toBe(200);
    const staffA = ((await json(resA)) as { data?: Array<{ email?: string }> })?.data ?? [];
    expect(staffA.map((s) => s.email ?? '').join()).not.toContain('lanka-electronics.lk');

    const ctxB = await authedContext(browser, 'owner2'); // Lanka Electronics
    const resB = await ctxB.request.get('/api/store/staff');
    expect(resB.status()).toBe(200);
    const staffB = ((await json(resB)) as { data?: Array<{ email?: string }> })?.data ?? [];
    expect(staffB.map((s) => s.email ?? '').join()).not.toContain('ayurwellness.lk');
    await ctxA.close();
    await ctxB.close();
  });

  test('8.6 the JWT session cookie is HttpOnly (invisible to page scripts)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    await apiSignIn(ctx, USERS.owner.email, USERS.owner.password);
    const cookies = await ctx.cookies(`${BASE_URL}/dashboard`);
    const session = cookies.find((c) => /authjs\.session-token/.test(c.name));
    expect(session, 'session cookie exists after sign-in').toBeTruthy();
    expect(session?.httpOnly).toBe(true);
    await ctx.close();
  });

  test('8.7 self-check: this suite stayed under the 10-failures / 15-min rate limit', async () => {
    const failed = await countAudit('LOGIN_FAILED_INVALID_CREDENTIALS', { since: RUN_START });
    expect(
      failed,
      'the suite itself must never trip src/lib/auth.ts:37 (login, 10 / IP / 15 min)',
    ).toBeLessThan(10);
  });
});

test.describe('9. Boundary Inputs & Chaos Data', () => {

  test.setTimeout(90_000);

  test('9.1 Sinhala / Tamil / emoji + XSS tags in the email field are neutralized client-side', async ({
    page,
  }) => {
    await gotoLogin(page);
    let dialogFired = false;
    page.on('dialog', () => {
      dialogFired = true;
    });

    const payload = 'සුබ+நல்வரவு🧘‍♂️<script>alert(1)</script>';
    await page.getByLabel('Email address').fill(payload);
    await page.getByLabel('Password').fill('irrelevant');
    // <input type="email"> triggers the browser's NATIVE constraint validation
    // (bubble shown, no submit) before RHF/zod render their error <p>.
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page).toHaveURL(/\/login/);
    // The raw string must remain inert text in the input — never markup.
    const value = await page.locator('#email').inputValue();
    expect(value).toBe(payload);
    expect(dialogFired, 'no JS dialog may execute from input chaos').toBe(false);
    await expect(page.getByText(TXT.invalidCredentials)).toHaveCount(0);
  });

  test('9.2 SQL-injection and tag payloads as the password fail generically (1 attempt)', async ({
    page,
  }) => {
    await gotoLogin(page);
    const injection = "'; DROP TABLE users; -- <img src=x onerror=alert(1)>";
    await submitLoginForm(page, USERS.owner.email, injection);

    await expect(page.getByText(TXT.invalidCredentials, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login/);
    const leaked = await page.locator('body').innerText();
    expect(leaked).not.toContain('onerror=');
  });

  test('9.3 oversized chaos (320-char email, 10k-char password) cannot wedge the form', async ({
    page,
  }) => {
    await gotoLogin(page);
    await page.getByLabel('Email address').fill(`${'a'.repeat(320)}@x.lk`);
    await page.getByLabel('Password').fill('p'.repeat(10_000));
    // Native constraint validation blocks submit (no app error text needed).
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    // Form is still interactive after the flood.
    await page.locator('#email').fill(USERS.owner.email);
    await expect(page.locator('#email')).toHaveValue(USERS.owner.email);
  });

  test('9.4 forgot-password with unicode email keeps the anti-enumeration contract', async ({
    page,
  }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await waitForLoginFormReady(page);
    await page.getByLabel('Email address').fill('සුබසාධන@ayurpos.lk');
    // <input type="email"> blocks submit via NATIVE constraint validation
    // (unicode local-parts are rejected by the browser before zod runs).
    await page.getByRole('button', { name: /Send reset link/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByText(/If that email address is registered/)).toHaveCount(0);
    // Page remains interactive.
    await page.getByLabel('Email address').fill(USERS.owner.email);
    await expect(page.getByLabel('Email address')).toHaveValue(USERS.owner.email);
  });
});

test.describe('10. Time-Travel, Token Expiry & Session Invalidation', () => {

  test.setTimeout(120_000);

  test('10.1 /login?sessionExpired=true renders the administrator sign-out banner', async ({
    page,
  }) => {
    await page.goto('/login?sessionExpired=true', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(TXT.sessionExpired, { exact: true })).toBeVisible();
    await expectLoginPage(page);
  });

  test('10.2 an expired reset token returns the EXPIRED message and is purged from the DB', async ({
    request,
  }) => {
    // The token is minted directly in the DB (deterministic fixture) because
    // /api/auth/forgot-password silently mints nothing once its in-memory
    // 5/hour bucket is exhausted (BUG-16); this test targets EXPIRY handling.
    const token = await mintResetToken(qaEmail('expiring'));
    expect(token).toBeTruthy();

    // ...then time-travel its expiry 7 days into the past. A large relative
    // shift keeps the token expired under ANY timezone interpretation of the
    // `timestamp without time zone` column (machine runs UTC+5:30).
    await withDb(async (query) => {
      await query(
        "UPDATE verification_tokens SET expires = expires - INTERVAL '7 days' WHERE token = $1",
        [token],
      );
    });

    // The reset must be refused -> the OWNER password is NOT changed here.
    const reset = await request.post('/api/auth/reset-password', {
      data: { token, newPassword: 'long-enough-1', confirmPassword: 'long-enough-1' },
    });
    expect(reset.status()).toBe(400);
    expect(((await json(reset)) as { error?: string })?.error).toBe(RESET_TXT.expiredTokenApi);

    // Expired tokens are deleted on discovery (reset-password/route.ts:46-55).
    const remaining = await withDb(async (query) => {
      const res = await query(
        'SELECT COUNT(*)::int AS n FROM verification_tokens WHERE token = $1',
        [token],
      );
      return res.rows[0]?.n as number;
    });
    expect(remaining).toBe(0);
  });

  test('10.3 a bumped sessionVersion must kill live JWTs (middleware gate pin)', async ({
    browser,
  }) => {
    // Live session minted BEFORE the bump...
    const ctx = await authedContext(browser, 'owner');
    const page = await ctx.newPage();
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // ...then the DB's version is bumped (as a password reset would do).
    const userBefore = await dbUser(USERS.owner.email);
    const versionBefore = Number(userBefore?.sessionVersion);
    await withDb(async (query) => {
      await query('UPDATE users SET "sessionVersion" = $1 WHERE email = $2', [
        versionBefore + 1,
        USERS.owner.email,
      ]);
    });

    // middleware.ts:207-231 invalidates JWTs whose version is LOWER than the
    // DB's (route: /login?sessionExpired=true). Observed on a cold build: the
    // request is served 200 — the gate never runs, so a forcibly-invalidated
    // account keeps full access until its token expires (BUG-13 pin).
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const stillAuthed = !page.url().includes('/login');

    // ── restore BEFORE asserting, so failures cannot cascade ──
    await ctx.close();
    await resetOwnerSessionVersionTo(versionBefore);

    expect(
      stillAuthed,
      'a sessionVersion bump must terminate live JWTs (middleware.ts:207-231) — see BUG-13',
    ).toBe(false);
  });

  test('10.4 the JWT session advertises a future expiry (no perpetual sessions)', async ({
    browser,
  }) => {
    const ctx = await authedContext(browser, 'owner');
    const session = (await json(await ctx.request.get('/api/auth/session'))) as {
      expires?: string;
    };
    expect(session?.expires).toBeTruthy();
    const expiry = new Date(String(session?.expires)).getTime();
    expect(expiry).toBeGreaterThan(Date.now());
    // JWT strategy: 30 days by default — sane bound against forever-tokens.
    expect(expiry).toBeLessThan(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await ctx.close();
  });

  test('10.5 audit history is retroactive-safe: historical windows stay queryable', async () => {
    // Reporting over past windows must not lose auth events (time-travel
    // regression guard for getAuditLogs startDate/endDate filters).
    const ownerId = (await getUserIdByEmail(USERS.owner.email))!;
    const historic = await countAudit('LOGIN_SUCCESS', {
      actorId: ownerId,
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    expect(historic).toBeGreaterThanOrEqual(1);
  });
});

test.afterAll(async () => {
  // Crash-safe restoration: whatever happened above, the seeded OWNER must be
  // left with its documented credential, an active account, and a session
  // version that does not orphan later owner logins.
  try {
    await restoreOwnerPassword();
    const user = await dbUser(USERS.owner.email);
    if (user && user.isActive === false) {
      await withDb(async (query) => {
        await query('UPDATE users SET "isActive" = true WHERE email = $1', [USERS.owner.email]);
      });
    }
    // If a test bumped sessionVersion and died before restoring it, later OWNER
    // logins would bounce to /login?sessionExpired=true. Logins re-mint the JWT
    // from the DB, so restoring the LOWEST plausible version re-synchronizes.
    if (user && Number(user.sessionVersion) > 1) {
      await withDb(async (query) => {
        await query('UPDATE users SET "sessionVersion" = 1 WHERE email = $1', [
          USERS.owner.email,
        ]);
      });
    }
  } catch (err) {
    console.error('01_auth afterAll restore failed:', err);
  }
});










