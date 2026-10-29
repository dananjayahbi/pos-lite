/**
 * Authenticated smoke test for the extended purchase-order API:
 * reference numbers, order date, discounts, draft/cancel, and PO payment
 * from a payment account.
 */
const BASE = 'http://localhost:3003';
const EMAIL = process.env.PROBE_EMAIL ?? 'owner@dilani-ayurwellness.lk';
const PASSWORD = process.env.PROBE_PASSWORD ?? 'owner123!';

const cookies = new Map();
const cookieHeader = () =>
  [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function req(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: 'manual',
    headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
  });
  storeCookies(res);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return { status: res.status, body };
}

async function login() {
  const csrf = await req('/api/auth/csrf');
  const form = new URLSearchParams({
    csrfToken: csrf.body?.csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: BASE,
    json: 'true',
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
    body: form.toString(),
  });
  storeCookies(res);
  const session = await req('/api/auth/session');
  if (!session.body?.user) throw new Error('login failed');
  return session.body.user;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const post = (path, body) =>
  req(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

(async () => {
  await login();
  console.log('logged in\n');

  const suppliers = await req('/api/store/suppliers?limit=1');
  const supplierId = suppliers.body?.data?.suppliers?.[0]?.id ?? suppliers.body?.data?.[0]?.id;
  check('supplier available', Boolean(supplierId), `supplierId=${supplierId}`);

  const products = await req('/api/store/products?limit=1');
  const productList = Array.isArray(products.body?.data)
    ? products.body.data
    : (products.body?.data?.products ?? []);
  const variantId = productList?.[0]?.variants?.[0]?.id;
  check('variant available', Boolean(variantId), `variantId=${variantId}`);

  // --- create with an explicit reference, order date and 10% discount ---
  const explicitRef = `PROBE-${Date.now()}`;
  const created = await post('/api/store/purchase-orders', {
    supplierId,
    referenceNo: explicitRef,
    orderDate: '2026-10-01',
    lines: [{ variantId, orderedQty: 10, expectedCostPrice: 1000 }],
    discountType: 'PERCENTAGE',
    discountValue: 10,
    paymentTermDays: 30,
    status: 'DRAFT',
    notes: 'probe PO',
  });
  check('POST create with reference + discount', created.status === 201, `status ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`);

  const po = created.body?.data;
  check('reference persisted', po?.referenceNo === explicitRef, `ref=${po?.referenceNo}`);
  check('subtotal = 10000', Number(po?.subtotalAmount) === 10000, `subtotal=${po?.subtotalAmount}`);
  check('discount = 1000 (10%)', Number(po?.discountAmount) === 1000, `discount=${po?.discountAmount}`);
  check('total = 9000', Number(po?.totalAmount) === 9000, `total=${po?.totalAmount}`);
  check('orderDate = 2026-10-01', String(po?.orderDate).startsWith('2026-10-01'), `orderDate=${po?.orderDate}`);
  check('paymentTermDays = 30', po?.paymentTermDays === 30, `terms=${po?.paymentTermDays}`);
  check('status = DRAFT', po?.status === 'DRAFT', `status=${po?.status}`);

  // --- auto-generated reference when none supplied ---
  const auto = await post('/api/store/purchase-orders', {
    supplierId,
    lines: [{ variantId, orderedQty: 2, expectedCostPrice: 500 }],
    status: 'DRAFT',
  });
  const autoRef = auto.body?.data?.referenceNo;
  check('auto reference generated', /^PO-\d{6}-\d{4}$/.test(autoRef ?? ''), `ref=${autoRef}`);
  check('auto total = 1000 (no discount)', Number(auto.body?.data?.totalAmount) === 1000, `total=${auto.body?.data?.totalAmount}`);

  // --- duplicate reference rejected ---
  const dup = await post('/api/store/purchase-orders', {
    supplierId,
    referenceNo: explicitRef,
    lines: [{ variantId, orderedQty: 1, expectedCostPrice: 100 }],
  });
  check('duplicate reference rejected', dup.status >= 400, `status ${dup.status}`);

  // --- fixed discount clamped to subtotal ---
  const fixed = await post('/api/store/purchase-orders', {
    supplierId,
    lines: [{ variantId, orderedQty: 1, expectedCostPrice: 300 }],
    discountType: 'FIXED',
    discountValue: 999999,
    status: 'DRAFT',
  });
  check('fixed discount clamped to subtotal', Number(fixed.body?.data?.totalAmount) === 0, `total=${fixed.body?.data?.totalAmount}`);

  // --- pay the PO from a payment account ---
  const acctName = `Probe Pay ${Date.now()}`;
  const acct = await post('/api/store/payment-accounts', {
    name: acctName,
    type: 'BANK',
    openingBalance: 50000,
  });
  const accountId = acct.body?.data?.id;
  check('payment account created', acct.status === 201, `status ${acct.status}`);

  const pay = await post(`/api/store/purchase-orders/${po.id}/payments`, {
    paymentAccountId: accountId,
    amount: 9000,
    reference: 'CHQ-001',
  });
  check('POST PO payment', pay.status === 201, `status ${pay.status} ${JSON.stringify(pay.body).slice(0, 200)}`);
  check('payment reports settled', pay.body?.data?.settled === true, `settled=${pay.body?.data?.settled}`);

  const acctAfter = await req(`/api/store/payment-accounts/${accountId}`);
  check('account debited to 41000', Number(acctAfter.body?.data?.balance) === 41000, `balance=${acctAfter.body?.data?.balance}`);

  const history = await req(`/api/store/purchase-orders/${po.id}/payments`);
  check('GET payment history', history.status === 200 && history.body?.data?.payments?.length === 1, `status ${history.status} count=${history.body?.data?.payments?.length}`);
  check('history paidTotal = 9000', Number(history.body?.data?.paidTotal) === 9000, `paidTotal=${history.body?.data?.paidTotal}`);

  // overpayment must be rejected
  const overpay = await post(`/api/store/purchase-orders/${po.id}/payments`, {
    paymentAccountId: accountId,
    amount: 1,
  });
  check('overpayment rejected', overpay.status === 422, `status ${overpay.status}`);

  // --- cancel a draft ---
  const toCancel = await post('/api/store/purchase-orders', {
    supplierId,
    lines: [{ variantId, orderedQty: 1, expectedCostPrice: 100 }],
    status: 'DRAFT',
  });
  const cancelId = toCancel.body?.data?.id;
  const cancelled = await post(`/api/store/purchase-orders/${cancelId}/cancel`, {});
  check('POST cancel draft', cancelled.status === 200 && cancelled.body?.data?.status === 'CANCELLED', `status ${cancelled.status} poStatus=${cancelled.body?.data?.status}`);

  // paying a cancelled PO must fail
  const payCancelled = await post(`/api/store/purchase-orders/${cancelId}/payments`, {
    paymentAccountId: accountId,
    amount: 10,
  });
  check('paying cancelled PO rejected', payCancelled.status === 409, `status ${payCancelled.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exitCode = 1;
  console.log(`CLEANUP_ACCOUNTS=${accountId}`);
  console.log(`CLEANUP_POS=${[po.id, auto.body?.data?.id, fixed.body?.data?.id, cancelId].join(',')}`);
})();
