/**
 * Authenticated smoke test for the payment-account API.
 * Logs in with the seeded owner account, then exercises create → deposit →
 * transfer → book → close, printing statuses so failures are obvious.
 */
const BASE = 'http://localhost:3003';
const EMAIL = process.env.PROBE_EMAIL ?? 'owner@dilani-ayurwellness.lk';
const PASSWORD = process.env.PROBE_PASSWORD ?? 'owner123!';

let cookies = new Map();

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
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
  const token = csrf.body?.csrfToken;
  if (!token) throw new Error('no csrf token');

  const form = new URLSearchParams({
    csrfToken: token,
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
  if (!session.body?.user) throw new Error(`login failed: ${JSON.stringify(session.body)}`);
  return session.body.user;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
  const user = await login();
  console.log(`logged in as ${user.email} (${user.role})\n`);

  const list = await req('/api/store/payment-accounts');
  check('GET list', list.status === 200, `status ${list.status}`);

  const name = `Probe Cash ${Date.now()}`;
  const create = await req('/api/store/payment-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      type: 'CASH',
      accountNumber: 'PROBE-001',
      openingBalance: 5000,
      note: 'smoke test',
      details: [{ label: 'Branch', value: 'Colombo' }],
    }),
  });
  check('POST create', create.status === 201, `status ${create.status} ${JSON.stringify(create.body).slice(0, 160)}`);
  const accountId = create.body?.data?.id;
  check('create returns opening balance 5000', Number(create.body?.data?.balance) === 5000, `balance=${create.body?.data?.balance}`);

  const book = await req(`/api/store/payment-accounts/${accountId}/book`);
  check('GET book', book.status === 200, `status ${book.status}`);
  check(
    'opening balance entry exists',
    book.body?.data?.entries?.some((e) => e.source === 'OPENING_BALANCE'),
    `entries=${book.body?.data?.entries?.length}`,
  );

  const deposit = await req(`/api/store/payment-accounts/${accountId}/deposit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 1500, note: 'owner top-up' }),
  });
  check('POST deposit', deposit.status === 201, `status ${deposit.status} ${JSON.stringify(deposit.body).slice(0, 160)}`);

  const afterDeposit = await req(`/api/store/payment-accounts/${accountId}`);
  check('balance after deposit = 6500', Number(afterDeposit.body?.data?.balance) === 6500, `balance=${afterDeposit.body?.data?.balance}`);

  // Second account to receive a transfer.
  const targetName = `Probe Bank ${Date.now()}`;
  const target = await req('/api/store/payment-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: targetName, type: 'BANK', openingBalance: 0 }),
  });
  const targetId = target.body?.data?.id;
  check('POST create target', target.status === 201, `status ${target.status}`);

  const transfer = await req('/api/store/payment-accounts/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fromAccountId: accountId, toAccountId: targetId, amount: 1000, note: 'banking' }),
  });
  check('POST transfer', transfer.status === 201, `status ${transfer.status} ${JSON.stringify(transfer.body).slice(0, 160)}`);

  const [src, dst] = await Promise.all([
    req(`/api/store/payment-accounts/${accountId}`),
    req(`/api/store/payment-accounts/${targetId}`),
  ]);
  check('source balance 5500 after transfer', Number(src.body?.data?.balance) === 5500, `balance=${src.body?.data?.balance}`);
  check('target balance 1000 after transfer', Number(dst.body?.data?.balance) === 1000, `balance=${dst.body?.data?.balance}`);

  // Overdraw must be rejected.
  const overdraw = await req('/api/store/payment-accounts/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fromAccountId: accountId, toAccountId: targetId, amount: 999999 }),
  });
  check('overdraw rejected', overdraw.status >= 400, `status ${overdraw.status}`);

  // Same-account transfer must be rejected by the validator.
  const same = await req('/api/store/payment-accounts/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fromAccountId: accountId, toAccountId: accountId, amount: 10 }),
  });
  check('same-account transfer rejected', same.status === 400, `status ${same.status}`);

  // Duplicate name must conflict.
  const dup = await req('/api/store/payment-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, type: 'CASH', openingBalance: 0 }),
  });
  check('duplicate name rejected', dup.status === 409, `status ${dup.status}`);

  // Closing without a sweep destination must fail while balance != 0.
  const closeNoDest = await req(`/api/store/payment-accounts/${accountId}/close`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  check('close blocked while balance remains', closeNoDest.status >= 400, `status ${closeNoDest.status}`);

  const close = await req(`/api/store/payment-accounts/${accountId}/close`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transferToAccountId: targetId, note: 'consolidating' }),
  });
  check('POST close with sweep', close.status === 200, `status ${close.status} ${JSON.stringify(close.body).slice(0, 160)}`);

  const finalTarget = await req(`/api/store/payment-accounts/${targetId}`);
  check(
    'target received swept balance (6500)',
    Number(finalTarget.body?.data?.balance) === 6500,
    `balance=${finalTarget.body?.data?.balance}`,
  );

  const cashFlow = await req('/api/store/payment-accounts/cash-flow');
  check('GET cash-flow', cashFlow.status === 200, `status ${cashFlow.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exitCode = 1;
  console.log(`CLEANUP_IDS=${accountId},${targetId}`);
})();
