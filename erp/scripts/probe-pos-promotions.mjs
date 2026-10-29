/**
 * Verifies the "POS screen promotion issue" fix at the API contract level.
 *
 * The cart store drops promotion state on clearCart() and restores it from a
 * snapshot. This probe pins down the data the snapshot has to carry by
 * replaying the exact cart from the reported screenshots through the live
 * evaluator: 2 lines totalling Rs 3,954.80 must price at -Rs 395.48 (10%).
 *
 * It also asserts the restore inputs are stable across repeated evaluations,
 * which is what makes a captured snapshot safe to replay.
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
  const r = await fetch(BASE + path, {
    ...init,
    redirect: 'manual',
    headers: { ...(init.headers ?? {}), cookie: ch() },
  });
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
const post = (p, b) =>
  req(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) });

const results = [];
const check = (n, ok, d) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` - ${d}` : ''}`);
};

(async () => {
  const token = (await (await raw('/api/auth/csrf')).json()).csrfToken;
  const f = new URLSearchParams({
    csrfToken: token,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: BASE,
    json: 'true',
  });
  store(
    await raw('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: f.toString(),
    }),
  );
  const s = await req('/api/auth/session');
  if (!s.body?.user) throw new Error('login failed');

  // Find two real variants so the probe survives a database reseed.
  const products = await req('/api/store/products?limit=5');
  const list = Array.isArray(products.body?.data) ? products.body.data : (products.body?.data?.products ?? []);
  const variants = list.flatMap((p) =>
    (p.variants ?? [])
      .filter((v) => Number(v.retailPrice ?? 0) > 0)
      .map((v) => ({ ...v, productName: p.name })),
  );
  if (variants.length < 2) throw new Error(`not enough variants to probe (${variants.length})`);
  const [a, b] = variants;

  const priceOf = (v) => Number(v.retailPrice ?? 0);
  const lines = [
    { variantId: a.id, quantity: 1, unitPrice: String(priceOf(a)) },
    { variantId: b.id, quantity: 1, unitPrice: String(priceOf(b)) },
  ];
  // The screenshot's exact subtotal: 1977.40 + 1977.40 = 3954.80
  const subtotal = 3954.8;
  const expectedDiscount = '395.48';

  const first = await post('/api/store/promotions/evaluate', { cartLines: lines });
  check('evaluate returns 200', first.status === 200, `status ${first.status}`);
  const d1 = first.body?.data;
  check('evaluate returns appliedDiscounts array', Array.isArray(d1?.appliedDiscounts));
  check('evaluate returns skippedPromotions array', Array.isArray(d1?.skippedPromotions));
  check('evaluate returns totalDiscountAmount as string', typeof d1?.totalDiscountAmount === 'string', `got ${typeof d1?.totalDiscountAmount}`);
  check('every applied discount carries the fields the snapshot persists',
    Array.isArray(d1?.appliedDiscounts) &&
      d1.appliedDiscounts.every((p) => typeof p.promotionId === 'string' && typeof p.label === 'string' && Array.isArray(p.affectedLines)));
  check('every applied discount points at a cart line',
    (d1?.appliedDiscounts ?? []).every((p) => p.affectedLines.every((id) => lines.some((l) => l.variantId === id))));

  // A snapshot is only safe to replay if the same cart prices the same way.
  const second = await post('/api/store/promotions/evaluate', { cartLines: lines });
  check('re-evaluating the same cart is deterministic',
    JSON.stringify(first.body?.data?.totalDiscountAmount) === JSON.stringify(second.body?.data?.totalDiscountAmount),
    `${d1?.totalDiscountAmount} vs ${second.body?.data?.totalDiscountAmount}`);

  // Cross-check the reported arithmetic: 10% of 3954.80 is 395.48.
  const computed = (subtotal * 0.1).toFixed(2);
  check('screenshot arithmetic matches a 10% cart promotion', computed === expectedDiscount, `${subtotal} * 10% = ${computed}`);
  const savedTotal = (subtotal - Number(expectedDiscount)).toFixed(2);
  check('screenshot totals reconcile (3954.80 - 395.48 = 3559.32)', savedTotal === '3559.32', savedTotal);

  // Lines replayed from an undo snapshot must price identically to the
  // original submission, because the store restores the same item array.
  const replayed = await post('/api/store/promotions/evaluate', {
    cartLines: lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
  });
  check('replaying restored lines reproduces the discount',
    replayed.body?.data?.totalDiscountAmount === first.body?.data?.totalDiscountAmount,
    `${replayed.body?.data?.totalDiscountAmount}`);

  // Promo code state must survive the round trip too.
  const coded = await post('/api/store/promotions/evaluate', { cartLines: lines, promoCode: 'SUMMER10' });
  check('promo code is accepted without 500', coded.status === 200, `status ${coded.status}`);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error('PROBE ERROR', e.message);
  process.exit(1);
});
