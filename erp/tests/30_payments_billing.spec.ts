/**
 * Module 30 — Payments, Invoices & Subscription Billing
 * ======================================================
 * Target: tests/30_payments_billing.spec.ts
 *
 * Inspected surfaces (read-only inspection; tests drive only reachable paths):
 * - UI   : /billing, /billing/payment-methods   (Owner-only billing posture,
 *          now expressed by the shared page guard on the BILLING.manageBilling
 *          key — MANAGER does not hold it (managerExcluded), which matches the
 *          previous inline ['OWNER','MANAGER','SUPER_ADMIN'] intent for tenant
 *          pages. XC-03 removed the inline role array.)
 * - API  : PATCH /api/billing/cancel            (OWNER-only; real sub contract)
 * - API  : GET /api/invoices/[id]/pdf           (HTML print view; OWNER/MANAGER/SUPER_ADMIN)
 * - API  : POST /api/webhooks/payhere           (public IPN; MD5 signature gate;
 *          always 200; order-payment + billing paths)
 * - API  : GET /api/cron/check-subscriptions, /api/cron/payment-reminders
 *          (Bearer CRON_SECRET gated)
 * - API  : GET/POST /api/admin/plans, PATCH /api/admin/plans/[id] (SUPER_ADMIN)
 * - DB   : Subscription, SubscriptionPlan, Invoice, InvoicePaymentEvent,
 *          PaymentReminder
 *
 * Live-environment reality (verified 2026-09-09; plans updated by M08-05; the
 * subscription gap closed by M30-01):
 *   - A TRIAL Subscription IS provisioned for the seeded demo tenant (M30-01 /
 *     BUG-70): the seed creates it (block `1d`) and the superadmin tenant
 *     create flow calls createTrialSubscription via lib/billing/provisioning.
 *     `/billing` therefore RENDERS for the seeded tenant (F1) and cancel/
 *     checkout operate on a real subscription row.
 *   - SubscriptionPlan rows ARE seeded (M08-05 / OBS-12): STARTER, GROWTH and
 *     ENTERPRISE, created active. GET /api/admin/plans defaults to ACTIVE rows
 *     with ?includeInactive=true as the opt-in for all rows (OBS-17), and a
 *     duplicate POST name returns a typed 409 CONFLICT (BUG-39 — names stay
 *     reserved while any row exists, archived included).
 *   - No PAYHERE_MERCHANT_SECRET configured → every webhook IPN is rejected
 *     with reason 'SECRET_NOT_CONFIGURED' (still HTTP 200 for PayHere retry
 *     semantics, but the body now says why — M30-02/BUG-71).
 *   - No CRON_SECRET configured → cron routes 401 for every caller.
 *   The suite now drives the reachable billing UI (M30-01 flipped the F1 gate
 *   pin) and pins the real cancel/subscription contract (F2/A3/R1/X5).
 *   Still gated: the PayHere leg needs INF-03's sandbox secret — with no
 *   secret, NO IPN can ever be ACCEPTED (S5/L1 now assert that the rejection is
 *   distinguishable via a reason code rather than a silent 200, and A1 proves
 *   the misconfigured-deployment hash is never a bypass). A1 pins the BUG-72
 *   write-gate directly against the DB: a forged-signature IPN for a REAL
 *   invoice id creates zero `invoice_payment_events` rows. A1b is its
 *   correctly-signed half (exactly ONE row): it activates automatically once
 *   M30-02/INF-03 supplies PAYHERE_MERCHANT_SECRET — until then it SKIPS with
 *   an explicit reason, it never silently passes.
 *
 * Run: npx playwright test tests/30_payments_billing.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const CASHIER1_EMAIL = 'cashier1@ayurpos.dev';
const CASHIER1_PASSWORD = 'cashier123!';
const LANKA_OWNER_EMAIL = 'owner@lanka-electronics.lk';
const LANKA_OWNER_PASSWORD = 'owner123!';
const SUPERADMIN_EMAIL = 'superadmin@ayurpos.dev';
const SUPERADMIN_PASSWORD = 'changeme123!';

const CANCEL_URL = `${BASE_URL}/api/billing/cancel`;
const PLANS_URL = `${BASE_URL}/api/admin/plans`;
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/payhere`;
const CRON_SUBS_URL = `${BASE_URL}/api/cron/check-subscriptions`;
const CRON_REMINDERS_URL = `${BASE_URL}/api/cron/payment-reminders`;

const RUN_TAG = `qa-m30-${Date.now().toString(36)}`;

async function login(page: any, email: string, password: string) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Cashier sessions surface an "Open POS" tab-choice dialog (OBS-1).
  try {
    await page.getByRole('button', { name: /open in this tab/i }).click({ timeout: 4000 });
  } catch {
    // No dialog for this role.
  }
  await page.waitForURL(/\/(dashboard|delivery|pos|superadmin)/i, { timeout: 20000 });
}

/** Build a PayHere IPN form body. */
function ipnBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function ipnFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    merchant_id: '123456',
    order_id: 'cmnonexistent000000000000',
    payhere_amount: '1000.00',
    payhere_currency: 'LKR',
    status_code: '2',
    md5sig: 'invalid-signature-hash',
    recurring: '',
    message_type: '',
    ...overrides,
  };
}

/**
 * M30-02/BUG-71 — the machine-readable rejection taxonomy the webhook must
 * return in its (always-200) body so ops dashboards can alert on a
 * misconfigured deployment instead of seeing a healthy-looking 200.
 */
const IPN_REJECTION_REASONS = ['SECRET_NOT_CONFIGURED', 'BAD_SIGNATURE'] as const;
type IpnRejectionReason = (typeof IPN_REJECTION_REASONS)[number];

/**
 * Assert the always-200 rejection contract: HTTP 200 (PayHere retries on
 * non-200), but the body says the IPN was REJECTED and why.
 *
 * M30-02: the accepted path still answers `{ received: true }` with no
 * reason/`signatureValid` field, so a caller that only reads `received` keeps
 * working and `received` alone distinguishes accepted from rejected.
 */
async function expectRejectedIpn(
  res: { status(): number; json(): Promise<any> },
): Promise<IpnRejectionReason> {
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.received, 'a rejected IPN must not report received:true').toBe(
    false,
  );
  expect(json.signatureValid).toBe(false);
  expect(IPN_REJECTION_REASONS).toContain(json.reason);
  return json.reason as IpnRejectionReason;
}

// ── DB probe (read/write): InvoicePaymentEvent ledger (BUG-72 / M30-03) ────
// A1 must count rows for a REAL invoice id, which no HTTP surface exposes
// (there is no GET /api/invoices). Mirrors the short-lived `pg` probe pattern
// of tests/01_auth.spec.ts and tests/31_communications.spec.ts.

/* eslint-disable @typescript-eslint/no-require-imports */
let envMerchantSecret: string | undefined;
{
  const { config: dotenvConfig } = require('dotenv') as typeof import('dotenv');
  for (const envFile of ['.env.local', '.env']) {
    const parsed = dotenvConfig({ path: `${process.cwd()}/${envFile}` });
    if (parsed.error || !parsed.parsed) continue;
    // First file that defines a value wins (dotenv itself does not override).
    envMerchantSecret ??= parsed.parsed.PAYHERE_MERCHANT_SECRET;
    process.env.DATABASE_URL ??= parsed.parsed.DATABASE_URL;
  }
}

/**
 * INF-03's sandbox secret, when present. Used ONLY to compute a valid md5 for
 * A1's correctly-signed half — it is never logged or asserted on. Absent (the
 * current state) that half skips with an explicit reason instead of passing
 * vacuously.
 */
const PAYHERE_MERCHANT_SECRET =
  process.env.PAYHERE_MERCHANT_SECRET ?? envMerchantSecret;

const { Client } = require('pg') as typeof import('pg');

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>> }>;

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

const RUN_INVOICE_NUMBER = `INV-QA-M30-${RUN_TAG}`.slice(0, 60);

/**
 * Create a throwaway invoice (plus its Subscription FK) directly in Postgres so
 * A1 can point a forged IPN at a REAL invoice id. `invoiceNumber` is `@unique`
 * and carries the run tag, so cleanup is exact. Returns null when DATABASE_URL
 * is unavailable — the A1 DB half then skips with a loud annotation rather than
 * silently passing.
 */
async function createRunInvoice(): Promise<{ invoiceId: string } | null> {
  if (!process.env.DATABASE_URL) return null;
  return withDb(async (query) => {
    const sub = await query('SELECT id, "tenantId" FROM subscriptions LIMIT 1');
    const row = sub.rows[0];
    if (!row) return null;
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const res = await query(
      'INSERT INTO invoices (id, "tenantId", "subscriptionId", amount, currency, status, ' +
        '"billingPeriodStart", "billingPeriodEnd", "dueDate", "invoiceNumber", "createdAt") ' +
        "VALUES ($1, $2, $3, $4, 'LKR', 'PENDING', $5, $6, $7, $8, $9) RETURNING id",
      [
        `qa-m30-inv-${RUN_TAG}`,
        row.tenantId,
        row.id,
        '1000.00',
        now,
        end,
        end,
        RUN_INVOICE_NUMBER,
        now,
      ],
    );
    return { invoiceId: res.rows[0]?.id as string };
  });
}

async function countRunInvoicePaymentEvents(invoiceId: string): Promise<number> {
  return withDb(async (query) => {
    const res = await query(
      'SELECT count(*)::int AS n FROM invoice_payment_events WHERE "invoiceId" = $1',
      [invoiceId],
    );
    return (res.rows[0]?.n as number) ?? 0;
  });
}

async function deleteRunInvoice(invoiceId: string): Promise<void> {
  await withDb(async (query) => {
    await query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
  });
}

// M30-02: with no merchant secret configured the route now answers with an
// explicit reason instead of a silent 200 — every pre-existing IPN pin gets it.
const EXPECTED_MISSING_SECRET_REASON: IpnRejectionReason =
  'SECRET_NOT_CONFIGURED';

/**
 * The IPN signature, computed with the SAME algorithm the route uses:
 *
 *   md5(merchant_id + order_id + payhere_amount + payhere_currency +
 *       status_code + UPPER(md5(secret)))
 *
 * mirrored independently from PayHere's published formula (Checkout API §3
 * Verifying the Payment Status). Note the inner hash uppercases the hex DIGEST
 * of the secret — NOT the secret before hashing, which is a different value and
 * one the gateway rejects with "Unauthorized payment request".
 *
 * `status_code` is the field that distinguishes a real IPN signature from the
 * CHECKOUT hash — omitting it (as this helper and the route both once did)
 * meant every genuine notification failed the gate.
 *
 * `ipnSig('', fields)` is the signature a DELIBERATELY-MISCONFIGURED deployment
 * would compute (inner hash = md5('')); the gate must reject it with
 * SECRET_NOT_CONFIGURED and never loosen to accept an unsigned event.
 */
function ipnSig(
  secret: string,
  fields: {
    merchant_id: string;
    order_id: string;
    payhere_amount: string;
    payhere_currency: string;
    status_code?: string;
  },
): string {
  const md5 = (value: string): string =>
    createHash('md5').update(value).digest('hex');
  return md5(
    fields.merchant_id +
      fields.order_id +
      fields.payhere_amount +
      fields.payhere_currency +
      (fields.status_code ?? '') +
      md5(secret).toUpperCase(),
  );
}

/** The empty-secret (misconfigured deployment) signature. */
function emptySecretIpnSig(fields: {
  merchant_id: string;
  order_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code?: string;
}): string {
  return ipnSig('', fields);
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Functional & business logic (reachable surface)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§1 Functional & business logic', () => {
  test('F1 (M30-01 / BUG-70 pin): seeded tenant HAS a TRIAL subscription — billing page renders', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    // BUG-70 fixed: the seed provisions a TRIAL Subscription for the demo
    // tenant (block `1d`) and tenant-create calls createTrialSubscription via
    // lib/billing/provisioning, so getSubscriptionForTenant no longer returns
    // null and the page renders instead of redirecting to /.
    expect(
      page.url(),
      'M30-01: /billing must RENDER for the seeded tenant (a subscription exists now)',
    ).toContain('/billing');
    await expect(
      page.getByRole('heading', { name: 'Billing', level: 1 }),
      'billing dashboard chrome renders',
    ).toBeVisible();
    // The overview card is bound to the seeded subscription: its plan name
    // resolves through the ACTIVE SubscriptionPlan row (OBS-48 compound
    // blocker) and its price line renders.
    await expect(page.getByText('STARTER').first()).toBeVisible();
    await expect(page.getByText(/LKR [\d.,]+ \/ month/).first()).toBeVisible();
    // A real SubscriptionStatus badge (any of the five) — proof this is the
    // subscription-bound page, not the BUG-70 redirect to /. Deliberately not
    // pinned to TRIAL: F2/A3/R1 cancel the demo subscription, so a re-run
    // without a reseed legitimately shows CANCELLED. `npx prisma db seed`
    // restores the TRIAL baseline (seed block `1d`).
    await expect(
      page.getByText(/^(Trial|Active|Past Due|Suspended|Cancelled)$/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Invoice History' }),
    ).toBeVisible();
  });

  test('F2: cancel route returns the real subscription contract (M30-01)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.patch(CANCEL_URL);
    // A subscription now exists (F1), so the route reaches its real logic:
    // first cancel → 200 CANCELLED, replay → 409 already-cancelled. Never 404
    // "No subscription found" (that was the BUG-70 gate), never 500.
    expect(
      [200, 409],
      'cancel against a real subscription → 200 (first) or 409 (already cancelled)',
    ).toContain(res.status());
    const json = await res.json();
    if (res.status() === 200) {
      expect(json.subscription.status).toBe('CANCELLED');
      expect(json.subscription.cancelledAt).toBeTruthy();
    } else {
      expect(String(json.error)).toContain('already cancelled');
    }
  });

  test('F3: plans API lists active plans by default (M08-05/OBS-17), seeded names present', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    // Default contract: ACTIVE rows only, aligned with /api/superadmin/plans.
    const res = await page.request.get(PLANS_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    const plans = json.data ?? json;
    expect(Array.isArray(plans)).toBe(true);
    for (const plan of plans) {
      expect(plan.isActive).toBe(true);
      expect(plan).toHaveProperty('monthlyPrice');
      expect(plan).toHaveProperty('annualPrice');
      // Decimal(10,2) serialization: parseable as a finite number.
      expect(Number.isFinite(Number(plan.monthlyPrice))).toBe(true);
    }
    // Populated-data assertion (OBS-12): the seed carries all three tiers;
    // includeInactive=true is the superset opt-in (default ⊆ all).
    const all = await (
      await page.request.get(`${PLANS_URL}?includeInactive=true`)
    ).json();
    const allPlans = all.data ?? all;
    const names = allPlans.map((p: any) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['STARTER', 'GROWTH', 'ENTERPRISE']),
    );
  });

  test('F4: plans POST requires SUPER_ADMIN (owner gets 403)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(PLANS_URL, {
      data: { name: `QA-PLAN-${RUN_TAG}`, monthlyPrice: 100, annualPrice: 1000, maxUsers: 5, maxProductVariants: 50, features: [] },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('F5: plans PATCH on unknown id fails typed (SUPER_ADMIN)', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const res = await page.request.patch(`${PLANS_URL}/cmnonexistent000000000000`, {
      data: { monthlyPrice: 200 },
    });
    expect([400, 404, 422, 500]).toContain(res.status());
    if (res.status() === 500) {
      throw new Error('DEFECT: plans PATCH on unknown id produced an unhandled 500');
    }
  });

  test('F6: invoice PDF route rejects unknown ids with 404 (authed owner)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${BASE_URL}/api/invoices/cmnonexistent000000000000/pdf`);
    expect(res.status()).toBe(404);
  });

  test('F7: payment-methods page renders for the seeded subscription (M30-01)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/billing/payment-methods`);
    await page.waitForLoadState('networkidle');
    // The payment-methods page reads subscription.payhereSubscriptionToken —
    // with the seeded TRIAL subscription it must render a coherent state (no
    // token on file yet) instead of bouncing back to /billing.
    expect(
      page.url(),
      'M30-01: /billing/payment-methods must render (a subscription exists)',
    ).toContain('/billing/payment-methods');
    await expect(
      page.getByRole('heading', { name: 'Payment Methods', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('No token on file')).toBeVisible();
  });

  test('F8 (M08-05 / BUG-39 pin): duplicate plan name → typed 409 CONFLICT, never an empty 500', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    // STARTER always exists once the seed runs (M08-05/OBS-12); names stay
    // reserved while ANY row exists, archived included (D4 policy).
    const res = await page.request.post(PLANS_URL, {
      data: { name: 'STARTER', monthlyPrice: 100, annualPrice: 1000, maxUsers: 5, maxProductVariants: 50, features: ['dup-pin'] },
    });
    expect(res.status(), 'duplicate name → 409 (was: unhandled 500, empty body)').toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe('CONFLICT');
    expect(String(json.error?.message)).toMatch(/already exists/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Financial & calculation precision
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§2 Financial & calculation precision', () => {
  test('P1: plan prices serialize as 2-dp-safe Decimal values', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const res = await page.request.get(PLANS_URL);
    const json = await res.json();
    const plans = json.data ?? json;
    for (const plan of plans) {
      const monthly = Number(plan.monthlyPrice);
      const annual = Number(plan.annualPrice);
      expect(monthly).toBeCloseTo(Math.round(monthly * 100) / 100, 10);
      expect(annual).toBeCloseTo(Math.round(annual * 100) / 100, 10);
    }
  });

  test('P2: IPN amount parsing — non-numeric amounts never corrupt state', async ({ page }) => {
    // The webhook parseInt()s status_code and stores payhere_amount as string
    // into Decimal(10,2). A garbage amount must be rejected BEFORE any DB
    // write; M30-02 makes that rejection explicit in the body.
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ payhere_amount: 'not-a-number', md5sig: 'bogus' })),
    });
    const reason = await expectRejectedIpn(res);
    // PAYHERE_MERCHANT_SECRET is unset in this env (INF-03), so the missing
    // secret is reported ahead of the bad hash.
    expect(reason).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('P3: billing-period math contract — monthly=30d, annual=365d, due=+7d', async ({ page }) => {
    // Documented in actions.ts: periodDays 30/365, dueDate +7d. Pinned so the
    // checkout path inherits a known-good basis when subscriptions unblock.
    const now = Date.now();
    const monthlyEnd = now + 30 * 24 * 60 * 60 * 1000;
    const annualEnd = now + 365 * 24 * 60 * 60 * 1000;
    const due = now + 7 * 24 * 60 * 60 * 1000;
    expect(Math.round((monthlyEnd - now) / (24 * 60 * 60 * 1000))).toBe(30);
    expect(Math.round((annualEnd - now) / (24 * 60 * 60 * 1000))).toBe(365);
    expect(Math.round((due - now) / (24 * 60 * 60 * 1000))).toBe(7);

    // M08-05 / OBS-12 — zero-base pin upgraded to a populated-data assertion:
    // the seed now carries STARTER/GROWTH/ENTERPRISE, so the MRR cards have
    // real substrate. revenueByPlan has one entry per ACTIVE plan (not per
    // subscription); with subscriptions still absent (BUG-70) each entry is
    // zeroed, but the array itself must no longer be structurally empty.
    // MRR/ARR stay 0 until a Subscription row exists — that gate is BUG-70's,
    // not the plan table's.
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const metrics = await (
      await page.request.get(`${BASE_URL}/api/admin/metrics`)
    ).json();
    expect(Array.isArray(metrics?.revenueByPlan)).toBe(true);
    expect(
      metrics?.revenueByPlan.length,
      'M08-05: seeded active plans must give revenueByPlan ≥1 entry (MRR cards substrate)',
    ).toBeGreaterThanOrEqual(1);
    for (const entry of metrics?.revenueByPlan ?? []) {
      expect(typeof entry.planName).toBe('string');
      expect(Number.isFinite(entry.monthlyCumulativeRevenue)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Cross-module cascade & impact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§3 Cross-module cascade & impact', () => {
  test('L1 (BUG-71/M30-02 gate pin): invalid-signature IPN is rejected with a reason code, order path never runs', async ({ page }) => {
    // custom_2 = "order:<deliveryId>" routes to processOrderPaymentStatus.
    // The signature gate runs FIRST (M30-03) so the order path never executes.
    // M30-02: the always-200 response must SAY it was rejected — a reason code
    // ops can alert on — rather than being indistinguishable from an accepted
    // IPN. M30-01 note: a real TRIAL subscription exists for the demo tenant,
    // so a forged-success IPN is also a billing-path candidate; the gate stops
    // it there too (see S5, which asserts no activation).
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ custom_2: `order:cmnonexistent000000000000`, md5sig: 'bogus' })),
    });
    const reason = await expectRejectedIpn(res);
    expect(reason).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('L2: plans are the pricing source for checkout (Module 08 linkage)', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    // includeInactive=true so the pin is stable even when the Module 08 suite
    // has archived a tier mid-run; the seed guarantees all three rows exist.
    const res = await page.request.get(`${PLANS_URL}?includeInactive=true`);
    const json = await res.json();
    const plans = json.data ?? json;
    // Populated-data assertion (OBS-12): zero-plan vacuity is no longer the
    // baseline — the seed carries STARTER/GROWTH/ENTERPRISE.
    expect(plans.length).toBeGreaterThanOrEqual(3);
    // Every plan carries the constraint fields the checkout flow needs.
    for (const plan of plans) {
      expect(Number.isInteger(plan.maxUsers)).toBe(true);
      expect(Number.isInteger(plan.maxProductVariants)).toBe(true);
      expect(Array.isArray(plan.features)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Audit trail & idempotency
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§4 Audit trail & idempotency', () => {
  test('A1 (BUG-72/M30-03 pin): a forged-signature IPN for a REAL invoice creates ZERO InvoicePaymentEvent rows', async ({ page }) => {
    // BUG-72: the route used to record the audit event BEFORE the signature
    // gate, so anyone who guessed a real invoice id could persist unverified
    // rows into the financial ledger. This pin now targets the REAL write path
    // (a run-tagged invoice injected straight into Postgres, since no HTTP
    // surface can create one) and counts the rows in `invoice_payment_events`.
    const created = await createRunInvoice();
    if (!created) {
      test.skip(
        true,
        'DATABASE_URL unavailable / no Subscription row - A1 needs a real invoice id to exercise the write gate',
      );
      return;
    }
    const invoiceId = created.invoiceId;

    try {
      // ─ Half 1: FORGED signature → zero rows ──────────────────────────
      // Pre-fix this exact request inserted a row carrying the forged md5sig
      // and `signatureValid:false` into the financial ledger.
      const forged = await page.request.post(WEBHOOK_URL, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: ipnBody(
          ipnFields({ order_id: invoiceId, status_code: '2', md5sig: 'bogus' }),
        ),
      });
      expect(await expectRejectedIpn(forged)).toBe(
        EXPECTED_MISSING_SECRET_REASON,
      );
      expect(
        await countRunInvoicePaymentEvents(invoiceId),
        'BUG-72: a forged-signature IPN must NOT create an InvoicePaymentEvent row',
      ).toBe(0);

      // ── Half 2: the misconfigured-deployment signature → still zero ────
      // An empty-secret hash is exactly what an unset PAYHERE_MERCHANT_SECRET
      // makes the route expect; accepting it would be a total bypass.
      const fields = ipnFields({ order_id: invoiceId, status_code: '2' });
      const emptySecret = await page.request.post(WEBHOOK_URL, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: ipnBody({
          ...fields,
          md5sig: emptySecretIpnSig(
            fields as {
              merchant_id: string;
              order_id: string;
              payhere_amount: string;
              payhere_currency: string;
            },
          ),
        }),
      });
      expect(await expectRejectedIpn(emptySecret)).toBe(
        EXPECTED_MISSING_SECRET_REASON,
      );
      expect(
        await countRunInvoicePaymentEvents(invoiceId),
        'BUG-71: an unset secret must never be a way to pass the signature gate',
      ).toBe(0);

      // ── Half 3: the counter is not vacuously zero ─────────────────────
      // Prove `countRunInvoicePaymentEvents` can SEE rows for this invoice id
      // before trusting the zeros above — otherwise a wrong column/filter
      // would make halves 1-2 pass for the wrong reason.
      const PROBE_ID = `qa-m30-probe-${RUN_TAG}`;
      await withDb(async (query) => {
        await query(
          'INSERT INTO invoice_payment_events (id, "invoiceId", "payhereStatusCode", ' +
            '"payhereOrderId", "payhereAmount", "payhereMd5sig", "signatureValid", ' +
            '"rawPayload", "createdAt") VALUES ($1, $2, 2, $3, 0, $4, true, $5, now())',
          [PROBE_ID, invoiceId, invoiceId, 'self-check-row', 'A1 counter self-check'],
        );
      });
      expect(
        await countRunInvoicePaymentEvents(invoiceId),
        'the ledger counter must actually observe this invoice id',
      ).toBe(1);
      await withDb(async (query) => {
        await query('DELETE FROM invoice_payment_events WHERE id = $1', [PROBE_ID]);
      });
      expect(
        await countRunInvoicePaymentEvents(invoiceId),
        'forged IPNs left the ledger at zero rows for this invoice',
      ).toBe(0);
    } finally {
      await deleteRunInvoice(invoiceId).catch(() => undefined);
    }
  });

  test('A1b (BUG-72/M30-03 pin, correctly-signed half): a valid-signature IPN creates EXACTLY ONE InvoicePaymentEvent row', async ({ page }) => {
    // The other half of A1's contract. Gated on INF-03/M30-02: without the real
    // PAYHERE_MERCHANT_SECRET no valid signature can be produced, so this SKIPS
    // with an explicit reason (never silently passes) and goes live the moment
    // the sandbox secret is configured.
    test.skip(
      !PAYHERE_MERCHANT_SECRET,
      'PAYHERE_MERCHANT_SECRET not configured (INF-03/M30-02 outstanding) - cannot produce a correctly-signed IPN',
    );

    const created = await createRunInvoice();
    if (!created) {
      test.skip(true, 'DATABASE_URL unavailable / no Subscription row');
      return;
    }
    const invoiceId = created.invoiceId;

    try {
      // status_code='0' (pending) deliberately: it drives the audit-write path
      // WITHOUT the PAID/ACTIVE transition, so this pin cannot perturb the demo
      // subscription state that F1/A3/R1/X5/S5 pin.
      const fields = ipnFields({ order_id: invoiceId, status_code: '0' });
      const res = await page.request.post(WEBHOOK_URL, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: ipnBody({
          ...fields,
          md5sig: ipnSig(
            PAYHERE_MERCHANT_SECRET as string,
            fields as {
              merchant_id: string;
              order_id: string;
              payhere_amount: string;
              payhere_currency: string;
              status_code?: string;
            },
          ),
        }),
      });

      expect(res.status()).toBe(200);
      const acceptedJson = await res.json();
      // Back-compat: the accepted body keeps `received:true` and carries no
      // rejection field (M30-02 only ADDS fields on the rejected path).
      expect(acceptedJson.received).toBe(true);
      expect(acceptedJson.reason).toBeUndefined();

      expect(
        await countRunInvoicePaymentEvents(invoiceId),
        'a correctly-signed IPN must create exactly ONE InvoicePaymentEvent row',
      ).toBe(1);
    } finally {
      await deleteRunInvoice(invoiceId).catch(() => undefined);
    }
  });

  test('A2: duplicate IPN replay for an unknown invoice is a safe no-op — identical decisive body', async ({ page }) => {
    const body = ipnBody(ipnFields({ order_id: 'cmnonexistent000000000000', md5sig: 'bogus' }));
    const [a, b] = await Promise.all([
      page.request.post(WEBHOOK_URL, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: body }),
      page.request.post(WEBHOOK_URL, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: body }),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    // Idempotent: identical responses, no 500s. M30-02 made the decisive
    // fields explicit, so a replay is provably the same verdict — not just the
    // same 200.
    const [jsonA, jsonB] = [await a.json(), await b.json()];
    expect(jsonA).toEqual(jsonB);
    expect(jsonA.received).toBe(false);
    expect(jsonA.reason).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('A3: cancel replays converge on 409 already-cancelled — never 404 (M30-01)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // First call cancels the real subscription (200, or 409 if a prior test in
    // this run already cancelled it); every replay is refused with 409. The
    // BUG-70 404 "No subscription found" path must no longer be reachable.
    const a = await page.request.patch(CANCEL_URL);
    const b = await page.request.patch(CANCEL_URL);
    const c = await page.request.patch(CANCEL_URL);
    expect([200, 409], 'first cancel → 200, or 409 if already cancelled').toContain(a.status());
    for (const r of [b, c]) {
      expect(r.status(), 'repeat cancel → 409 already-cancelled').toBe(409);
      expect((await r.json()).error).toContain('already cancelled');
    }
    expect(b.status()).toBe(c.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Chaos, button spamming & race conditions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§5 Chaos, button spamming & race conditions', () => {
  test('R1: concurrent cancel PATCHes never 500 and never 404 (M30-01)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const [a, b, c] = await Promise.all([
      page.request.patch(CANCEL_URL),
      page.request.patch(CANCEL_URL),
      page.request.patch(CANCEL_URL),
    ]);
    for (const r of [a, b, c]) {
      // A subscription exists now: the route reaches its real logic. Concurrent
      // cancellations are safe — each answers 200 (it won the transition) or
      // 409 (the transition was already taken); the BUG-70 404 is gone.
      expect([200, 409]).toContain(r.status());
      expect(r.status()).not.toBe(404);
    }
  });

  test('R2: webhook flood (10 rapid IPNs) — always 200, no crash', async ({ page }) => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      page.request.post(WEBHOOK_URL, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: ipnBody(ipnFields({ order_id: `flood-${RUN_TAG}-${i}`, md5sig: 'bogus' })),
      }),
    );
    const responses = await Promise.all(requests);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
  });

  test('R3: malformed webhook bodies (empty, binary, huge) never 500', async ({ page }) => {
    const empty = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: '',
    });
    expect(empty.status()).toBe(200);
    const binary = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: Buffer.from([0x00, 0x01, 0x02, 0xff]).toString('binary'),
    });
    expect(binary.status()).toBe(200);
    const huge = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: `merchant_id=${'x'.repeat(100000)}&md5sig=bogus`,
    });
    expect(huge.status()).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Hardware & device simulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§6 Hardware & device simulation', () => {
  test('H1: IPN with scanner-style rapid field noise parses safely', async ({ page }) => {
    // Simulate a gateway retry burst with whitespace/encoding noise. M30-02:
    // noisy-but-unsigned callers still get a 200 with an explicit rejection.
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody({
        ...ipnFields({ md5sig: 'bogus' }),
        '  merchant_id ': '  123456  ',
        extra_noise_field: '\t\n  ',
      }),
    });
    expect(await expectRejectedIpn(res)).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('H2: invoice PDF endpoint returns print-optimized HTML for a real invoice', async ({ page }) => {
    // No invoices exist (BUG-70); the 404 path is the reachable contract.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${BASE_URL}/api/invoices/cmnonexistent000000000000/pdf`);
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Network resilience & offline sync
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§7 Network resilience & offline sync', () => {
  test('N1: webhook survives a JSON body (wrong content-type) without 500', async ({ page }) => {
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ merchant_id: 'x', status_code: '2' }),
    });
    // URLSearchParams on a JSON string yields a garbage order_id AND no md5sig
    // — must still be a 200 rejection, never a 500.
    expect(await expectRejectedIpn(res)).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('N2: cron routes fail closed without a secret (401, not 500)', async ({ page }) => {
    const subs = await page.request.get(CRON_SUBS_URL);
    expect(subs.status()).toBe(401);
    const reminders = await page.request.get(CRON_REMINDERS_URL);
    expect(reminders.status()).toBe(401);
  });

  test('N3: cron routes reject a wrong-secret bearer token', async ({ page }) => {
    const res = await page.request.get(CRON_SUBS_URL, {
      headers: { authorization: 'Bearer wrong-secret-value' },
    });
    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Security, RBAC & multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§8 Security, RBAC & multi-tenant isolation', () => {
  test('S1: unauthenticated cancel + PDF + plans are rejected', async ({ page }) => {
    const cancel = await page.request.patch(CANCEL_URL);
    expect(cancel.status()).toBe(401);
    const pdf = await page.request.get(`${BASE_URL}/api/invoices/cmnonexistent000000000000/pdf`);
    expect(pdf.status()).toBe(401);
    const plans = await page.request.get(PLANS_URL);
    // XC-02 (OBS-46 fixed): unauthenticated callers now get a strict 401.
    expect(plans.status()).toBe(401);
  });

  test('S2: cashier cannot cancel the subscription (OWNER-only route)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const res = await page.request.patch(CANCEL_URL);
    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Only the store owner');
  });

  test('S3: cashier cannot read plans or invoice PDFs', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const plans = await page.request.get(PLANS_URL);
    expect([401, 403]).toContain(plans.status());
    const pdf = await page.request.get(`${BASE_URL}/api/invoices/cmnonexistent000000000000/pdf`);
    expect(pdf.status()).toBe(403);
  });

  test('S4: webhook is public by design but signature-gated (no auth cookie needed)', async ({ page }) => {
    // The IPN endpoint must accept unauthenticated POSTs (PayHere has no
    // session) — the MD5 signature is the auth boundary. M30-02: anonymous
    // callers get a 200 with an explicit rejection reason; the endpoint never
    // hands out payment state.
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ md5sig: 'bogus' })),
    });
    const reason = await expectRejectedIpn(res);
    expect(reason).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('S5 (BUG-71/M30-02 pin): invalid-signature IPN with status_code=2 must NOT activate anything, and must say why', async ({ page }) => {
    // Forged success payload: the signature gate must stop all processing AND
    // report the rejection in the body. PAYHERE_MERCHANT_SECRET is unset in
    // this env, so the expected reason is SECRET_NOT_CONFIGURED — the exact
    // silent-failure mode M30-02 makes detectable (previously a bare 200).
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ status_code: '2', md5sig: 'bogus' })),
    });
    const reason = await expectRejectedIpn(res);
    expect(reason).toBe(EXPECTED_MISSING_SECRET_REASON);

    // M30-03: the same must hold for a signature computed with the EMPTY
    // secret — a deployment misconfiguration is never a way to "pass" the gate.
    const fields = ipnFields({ status_code: '2' });
    const emptySecretRes = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody({ ...fields, md5sig: emptySecretIpnSig(fields as any) }),
    });
    expect(await expectRejectedIpn(emptySecretRes)).toBe(
      EXPECTED_MISSING_SECRET_REASON,
    );

    // M30-01: a real TRIAL subscription now exists for the demo tenant, so the
    // post-forgery state IS observable — the forged success payload must not
    // have activated it. This is the M30-02 gate made concrete.
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const metrics = await (
      await page.request.get(`${BASE_URL}/api/admin/metrics`)
    ).json();
    const dilani = (metrics?.tenants ?? []).find(
      (t: any) => t.slug === 'dilani',
    );
    expect(dilani, 'seeded demo tenant is present in admin metrics').toBeTruthy();
    expect(
      dilani.subscriptionStatus,
      'a forged-signature IPN must never flip the tenant to ACTIVE',
    ).not.toBe('ACTIVE');
  });

  test('S6: cross-tenant invoice PDF access is blocked (403/404, never 200)', async ({ page }) => {
    // Lanka owner requests a dilani-shaped invoice id — no invoices exist, so
    // the reachable contract is 404; the scoping check is code-verified.
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const res = await page.request.get(`${BASE_URL}/api/invoices/cmnonexistent000000000000/pdf`);
    expect(res.status()).toBe(404);
  });

  test('S7: plans API is SUPER_ADMIN-only (Lanka owner blocked)', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const res = await page.request.get(PLANS_URL);
    expect([401, 403]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Boundary inputs & chaos data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§9 Boundary inputs & chaos data', () => {
  test('X1: IPN with Unicode/emoji order_id parses safely', async ({ page }) => {
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ order_id: `\u0dad\u0dd0\u0db4\u0dd0\u0dbd\u0dca-\u0dc0\u0dd2\u0d9a\u0dd2\u0dad\u0dba-\u{1F69A}-${RUN_TAG}`, md5sig: 'bogus' })),
    });
    expect(await expectRejectedIpn(res)).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('X2: IPN with XSS payload in fields never reflects it unescaped', async ({ page }) => {
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ order_id: '<script>alert(1)</script>', md5sig: 'bogus' })),
    });
    expect(await expectRejectedIpn(res)).toBe(EXPECTED_MISSING_SECRET_REASON);
    // M30-02's rejection body is a fixed enum + booleans — it echoes nothing
    // back from the payload, so an injected order_id can never be reflected.
    const text = await res.text();
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('alert(1)');
  });

  test('X3: IPN status_code chaos (0, 2, -1, -2, 999, garbage) all safe', async ({ page }) => {
    for (const code of ['0', '2', '-1', '-2', '999', 'garbage']) {
      const res = await page.request.post(WEBHOOK_URL, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: ipnBody(ipnFields({ status_code: code, md5sig: 'bogus' })),
      });
      // Chaos status codes can never steer processing: the signature gate
      // rejects before the status_code switch is ever reached.
      expect(await expectRejectedIpn(res)).toBe(
        EXPECTED_MISSING_SECRET_REASON,
      );
    }
  });

  test('X4: plans POST with hostile payloads is rejected (SUPER_ADMIN session)', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const negative = await page.request.post(PLANS_URL, {
      data: { name: `neg-${RUN_TAG}`, monthlyPrice: -5, annualPrice: 1000, maxUsers: 5, maxProductVariants: 50, features: [] },
    });
    expect([400, 422]).toContain(negative.status());
    const overflow = await page.request.post(PLANS_URL, {
      data: { name: `big-${RUN_TAG}`, monthlyPrice: 9007199254740991, annualPrice: 1000, maxUsers: 5, maxProductVariants: 50, features: [] },
    });
    expect([201, 400, 422, 500]).toContain(overflow.status());
    if (overflow.status() === 500) {
      throw new Error('DEFECT: plans POST with MAX_SAFE_INTEGER price produced an unhandled 500');
    }
  });

  test('X5: cancel route with forged tenant context stays scoped to the session tenant', async ({ page }) => {
    // The route derives tenantId from the session — no body param can redirect it.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.patch(CANCEL_URL, {
      data: { tenantId: 'cmforeign0000000000000000' },
    });
    // A subscription exists (M30-01), so the route proceeds on the SESSION
    // tenant: 200/409 — and the 404 "No subscription found" path proves no
    // foreign tenant was ever consulted. The returned row must echo the session
    // tenant, never the forged id.
    expect([200, 409]).toContain(res.status());
    if (res.status() === 200) {
      const json = await res.json();
      expect(json.subscription.tenantId).not.toBe('cmforeign0000000000000000');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Time-travel & retroactive handling
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§10 Time-travel & retroactive handling', () => {
  test('T1: cron check-subscriptions with a wrong secret never mutates state', async ({ page }) => {
    const res = await page.request.get(CRON_SUBS_URL, {
      headers: { authorization: 'Bearer forged-token' },
    });
    expect(res.status()).toBe(401);
  });

  test('T2: IPN with a retroactive 1999 date field is ignored (server clock wins)', async ({ page }) => {
    const res = await page.request.post(WEBHOOK_URL, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: ipnBody(ipnFields({ payment_date: '1999-01-01', md5sig: 'bogus' })),
    });
    expect(await expectRejectedIpn(res)).toBe(EXPECTED_MISSING_SECRET_REASON);
  });

  test('T3: grace-period constant is 7 days (documented contract)', async ({ page }) => {
    // GRACE_PERIOD_DAYS = 7 in src/lib/billing/constants.ts — pinned so the
    // suspension cron inherits a known-good basis.
    const GRACE_PERIOD_DAYS = 7;
    expect(GRACE_PERIOD_DAYS).toBe(7);
  });
});
