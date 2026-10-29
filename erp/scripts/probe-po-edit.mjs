/**
 * Verifies the "Purchase Order Edit" requirement end to end:
 *  - a RECEIVED PO can have its reference / terms / discount / order date edited
 *  - the edit actually persists (re-read and compare)
 *  - a CANCELLED PO is refused
 *  - rewriting the LINES of a PO with received qty is refused (409)
 *  - the detail payload exposes `linesEditable`
 */
const BASE = 'http://localhost:3003';
const EMAIL = 'owner@dilani-ayurwellness.lk';
const PASSWORD = 'owner123!';

const cookies = new Map();
const ch = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
function store(r) {
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [p] = c.split(';');
    const i = p.indexOf('=');
    if (i > 0) cookies.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
}
async function raw(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, redirect: 'manual', headers: { ...(init.headers ?? {}), cookie: ch() } });
  store(r);
  return r;
}
async function req(path, init) {
  const r = await raw(path, init);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: r.status, body };
}
const patch = (p, b) => req(p, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const post = (p, b) => req(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) });

const results = [];
const check = (n, ok, d) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); };

(async () => {
  const token = (await (await raw('/api/auth/csrf')).json()).csrfToken;
  const f = new URLSearchParams({ csrfToken: token, email: EMAIL, password: PASSWORD, callbackUrl: BASE, json: 'true' });
  store(await raw('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() }));
  const s = await req('/api/auth/session');
  if (!s.body?.user) throw new Error('login failed');
  console.log('logged in\n');

  const list = await req('/api/store/purchase-orders?limit=100');
  const all = list.body?.data?.purchaseOrders ?? [];
  const received = all.find((p) => p.status === 'RECEIVED');
  const cancelled = all.find((p) => p.status === 'CANCELLED');
  check('found a RECEIVED PO', Boolean(received), received?.referenceNo);
  check('found a CANCELLED PO', Boolean(cancelled), cancelled?.referenceNo);

  // ---- detail exposes linesEditable ----
  const detail = await req(`/api/store/purchase-orders/${received.id}`);
  check('detail exposes linesEditable=false for received', detail.body?.data?.linesEditable === false,
    `linesEditable=${detail.body?.data?.linesEditable}`);

  // ---- edit header fields on a RECEIVED PO ----
  const before = detail.body.data;
  const newRef = `EDITED-${Date.now().toString().slice(-6)}`;
  const edit = await patch(`/api/store/purchase-orders/${received.id}`, {
    referenceNo: newRef,
    orderDate: '2026-09-15T12:00:00.000Z',
    paymentTermDays: 30,
    discountType: 'FIXED',
    discountValue: 500,
  });
  check('PATCH received PO accepted', edit.status === 200, `status ${edit.status} ${JSON.stringify(edit.body).slice(0, 180)}`);

  const after = await req(`/api/store/purchase-orders/${received.id}`);
  const a = after.body?.data;
  check('reference persisted', a?.referenceNo === newRef, `ref=${a?.referenceNo}`);
  check('orderDate persisted (Sep 15)', String(a?.orderDate).startsWith('2026-09-15'), `orderDate=${a?.orderDate}`);
  check('paymentTermDays persisted = 30', a?.paymentTermDays === 30, `terms=${a?.paymentTermDays}`);
  check('discountType persisted = FIXED', a?.discountType === 'FIXED', `type=${a?.discountType}`);
  check('discountAmount = 500', Number(a?.discountAmount) === 500, `discount=${a?.discountAmount}`);
  check(
    'total recomputed = subtotal - 500',
    Number(a?.totalAmount) === Number(a?.subtotalAmount) - 500,
    `subtotal=${a?.subtotalAmount} total=${a?.totalAmount}`,
  );
  check('status unchanged by edit', a?.status === 'RECEIVED', `status=${a?.status}`);

  // ---- lines of a received PO must be refused ----
  const lineEdit = await patch(`/api/store/purchase-orders/${received.id}`, {
    lines: [{ variantId: before.lines[0].variantId, orderedQty: 1, expectedCostPrice: 1 }],
  });
  check('editing received lines rejected (409)', lineEdit.status === 409, `status ${lineEdit.status}`);

  // ---- cancelled PO refused ----
  const cancelledEdit = await patch(`/api/store/purchase-orders/${cancelled.id}`, {
    referenceNo: `X-${Date.now().toString().slice(-6)}`,
  });
  check('editing CANCELLED PO rejected', cancelledEdit.status >= 400, `status ${cancelledEdit.status}`);

  // ---- duplicate reference refused ----
  const other = all.find((p) => p.id !== received.id);
  const dup = await patch(`/api/store/purchase-orders/${received.id}`, { referenceNo: other.referenceNo });
  check('duplicate reference rejected', dup.status >= 400, `status ${dup.status}`);

  // ---- restore the original reference so the demo data is unchanged ----
  const restore = await patch(`/api/store/purchase-orders/${received.id}`, {
    referenceNo: before.referenceNo,
    orderDate: before.orderDate,
    paymentTermDays: before.paymentTermDays,
    discountType: before.discountType,
    discountValue: Number(before.discountValue),
  });
  check('restored original values', restore.status === 200, `status ${restore.status}`);
  const final = await req(`/api/store/purchase-orders/${received.id}`);
  check('reference back to original', final.body?.data?.referenceNo === before.referenceNo, `ref=${final.body?.data?.referenceNo}`);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exitCode = 1;
})();
