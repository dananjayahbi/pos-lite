/**
 * Module 27 — Doctor Appointments & Clinic Management
 * Full 10-point spectrum QA suite.
 *
 * Code facts (verified 2026-09-12 via probes _probe_m27/m27b/m27c):
 * - GET/POST /api/store/appointments: gates 'appointment:view' / 'appointment:create' (CASHIER HAS BOTH;
 *   DISPATCH/STOCK_CLERK lack all appointment perms). Filters zod-validated (status enum, page>=1,
 *   limit 1..200) → 400 VALIDATION_ERROR. Envelope {success,data:{appointments,total,page,limit}},
 *   orderBy startTime asc. Create: walk-in refine (customerId OR walkInName+walkInPhone), endTime>startTime,
 *   durationMins int>=5, price>=0 → 201. Default title = serviceId?'Appointment':walkInName||'Walk-in'.
 *   Staff overlap guard (findFirst, status notIn CANCELLED/NO_SHOW) → 409 CONFLICT — but NON-ATOMIC:
 *   3 concurrent same-staff bookings all 201 (BUG-92 pin).
 * - [id] GET/PATCH/DELETE: view/edit/cancel gates. DELETE = soft CANCEL (row stays). PATCH applies ANY
 *   status directly — no transition guard (SCHEDULED→COMPLETED 200; COMPLETED→CANCELLED 200 — BUG-88 pins).
 * - [id]/cancel: appointment:cancel gate; frees slot; audit CANCEL. Idempotent double-cancel 200.
 * - [id]/check-in: appointment:checkin gate (CASHIER has it) → CHECKED_IN + checkedInAt.
 * - [id]/complete + [id]/no-show + [id]/convert-to-sale: AUTH-ONLY, NO PERMISSION GATE (BUG-86 pin —
 *   CASHIER completes/no-shows appointments with 200).
 * - convert-to-sale: ALWAYS 500 (BUG-85 pin) — sale.create uses shiftId:'' → FK violation, raw
 *   Prisma/Turbopack internals leak in message. Guards before the crash: non-COMPLETED → 400
 *   'Only completed appointments can be converted', re-convert → 409 ALREADY_CONVERTED (unreachable
 *   once the 500 is fixed).
 * - reminders GET: auth-only, NO tenant scoping (BUG-87 IDOR pin — foreign tenant reads by appointmentId).
 *   appointmentId required → 400; unknown id → 200 [] (no 404). Dead code: schedule/process functions
 *   have ZERO callers, no cron route → reminders never created or sent (OBS-77).
 * - services: GET view / POST manageServices (name 1..100, durationMins 5..480, price>=0, color hex
 *   #RRGGBB). Duplicate → 409 SERVICE_NAME_EXISTS. [id] PATCH/DELETE manageServices; DELETE = soft
 *   (deletedAt); NO in-use guard (deleting a service with linked appointments → 200); recreate-after-
 *   soft-delete → 500 (DB @@unique([tenantId,name]) vs deletedAt-null pre-check — BUG-90 pin).
 * - slots GET: date required → 400; malformed date → 500 (BUG-89 pin; same for stats/time-off dateFrom).
 *   slots/generate POST: manageSchedule; {startDate,endDate} ISO; idempotent (2nd run created:0 via
 *   @@unique([staffId,date,startTime])); bad dates → 400.
 * - availability: GET view (staffId optional); POST bulk manageSchedule {staffId, entries[{dayOfWeek
 *   0..6, startTime/endTime HH:mm, slotDurationMins 5..120}]} upsert @@unique([staffId,dayOfWeek]).
 * - time-off: GET auth-only (NO gate — OBS-80); POST manageSchedule → 201 isApproved:false;
 *   [id] PATCH approve {isApproved:true} → 200; DELETE manageSchedule.
 * - stats GET: view gate → {total, byStatus, noShowRate 2dp, revenue (COMPLETED price sum)}.
 * - Decimal(10,2): price 100.456 → 100.46; 1e12 → 500 numeric overflow (BUG-91 pin).
 * - No backdate guard: startTime in the past → 201 (OBS-79 pin).
 * - Audit: CREATE/CANCEL/CONVERT_TO_SALE rows only — PATCH/check-in/complete write NOTHING (A1 pin);
 *   actorRole hardcoded 'OWNER' even for CASHIER actors (BUG-93 pin).
 * - UI: /appointments feature-toggle 'appointments' + view gate → /dashboard; calendar Day/Week/Month
 *   toggles + Today; /appointments/list 'New Appointment' → dialog. /settings manageSettings gate.
 * - Public POST /api/public/site/[tenantSlug]/appointments: no auth; unknown slug 404; SUSPENDED 403;
 *   module disabled 409; walkInName/phone + ISO times + durationMins>=5 + price>=0 → 201.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const APPTS_API = `${BASE}/api/store/appointments`;
const SERVICES_API = `${BASE}/api/store/appointments/services`;
const SLOTS_API = `${BASE}/api/store/appointments/slots`;
const AVAIL_API = `${BASE}/api/store/appointments/availability`;
const TIMEOFF_API = `${BASE}/api/store/appointments/time-off`;
const REMINDERS_API = `${BASE}/api/store/appointments/reminders`;
const STATS_API = `${BASE}/api/store/appointments/stats`;
const AUDIT_API = `${BASE}/api/audit-logs`;
const PUBLIC_BOOK_API = `${BASE}/api/public/site/dilani/appointments`;
const PUBLIC_BOOK_BAD_API = `${BASE}/api/public/site/no-such-tenant/appointments`;

const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const DISPATCH = { email: 'dispatch@ayurpos.dev', password: 'dispatch123!' };
const SUPERADMIN = { email: 'superadmin@ayurpos.dev', password: 'changeme123!' };
const FOREIGN_OWNER = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };

// Stable across worker restarts within one run.
const g = globalThis as { __m27run?: string };
const RUN = (g.__m27run ??= `qa-m27-${Date.now()}`);
// Per-run day base: bookings land in a fresh window every run so the time-based
// staff-overlap guard never collides with leftovers from a previous (failed) run.
const DAY_BASE = 30 + (Number(RUN.slice(-7)) % 3000);

async function login(page: Page, email: string, password: string): Promise<void> {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  try {
    await page.getByRole('button', { name: /open in this tab/i }).click({ timeout: 4000 });
  } catch {
    /* non-cashier roles have no dialog */
  }
  await page.waitForURL(/\/(dashboard|delivery|pos|superadmin)/i, { timeout: 20000 });
}

/** Future ISO datetime at day-offset d, hour h (h≥40 offsets avoid probe-era fixtures). */
function iso(d: number, h = 10): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, 0, 0, 0);
  return dt.toISOString();
}

/** Audit feed envelope is {success, data:{data:[…], meta}} — extract the row array. */
function auditRows(feed: any): Array<{ entityId: string; action: string; actorRole: string; actorId: string }> {
  const d = feed?.data;
  return (Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []) as never;
}

interface ApptInput {
  customerId?: string | null;
  walkInName?: string;
  walkInPhone?: string;
  serviceId?: string | null;
  staffId?: string | null;
  startTime: string;
  endTime: string;
  durationMins: number;
  price: number;
  title?: string;
  notes?: string;
  depositAmount?: number;
}

async function createAppt(page: Page, input: ApptInput): Promise<{ status: number; body: any }> {
  const res = await page.request.post(APPTS_API, { data: input });
  return { status: res.status(), body: await res.json() };
}

/** Create a walk-in appointment in a private far-future day window (no overlap with anything). */
async function newWalkIn(page: Page, tag: string, dayOffset: number): Promise<any> {
  const { status, body } = await createAppt(page, {
    walkInName: `${RUN} ${tag}`,
    walkInPhone: '0771234567',
    startTime: iso(dayOffset),
    endTime: iso(dayOffset, 11),
    durationMins: 30,
    price: 2500,
  });
  expect(status).toBe(201);
  return body.data;
}

/** The OWNER user id (usable as staffId) — derived from a fresh throwaway booking (worker-safe). */
async function ownerId(page: Page): Promise<string> {
  const probe = await newWalkIn(page, 'owner-probe', 38);
  return probe.createdById as string;
}

test.describe.serial('Module 27 — Doctor Appointments & Clinic Management', () => {
  test.describe.configure({ timeout: 120_000 });

  // ─── §1 Functional & Business Lifecycle ───────────────────────────────
  test('F1 — walk-in booking: 201, SCHEDULED, default title, full shape', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'F1', 40);
    expect(a.status).toBe('SCHEDULED');
    expect(a.title).toBe(`${RUN} F1`); // walkInName default
    expect(a.walkInPhone).toBe('0771234567');
    expect(Number(a.price)).toBe(2500);
    expect(a.durationMins).toBe(30);
    expect(new Date(a.endTime).getTime()).toBeGreaterThan(new Date(a.startTime).getTime());
    // Dead-code reminder scheduler never runs (OBS-77): the detail view shows zero reminders.
    const detail = await (await page.request.get(`${APPTS_API}/${a.id}`)).json();
    expect(detail.data.reminders).toEqual([]);
  });

  test('F2 — create validation: patient identity refine + time/price/duration bounds → 400', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const noPatient = await createAppt(page, { startTime: iso(41), endTime: iso(41, 11), durationMins: 30, price: 1 });
    expect(noPatient.status).toBe(400);
    expect(noPatient.body.error.code).toBe('VALIDATION_ERROR');
    const endBefore = await createAppt(page, {
      walkInName: 'x', walkInPhone: '077', startTime: iso(41, 12), endTime: iso(41, 10), durationMins: 30, price: 1,
    });
    expect(endBefore.status).toBe(400);
    expect(JSON.stringify(endBefore.body.error.details)).toContain('End time must be after start time');
    const shortDur = await createAppt(page, {
      walkInName: 'x', walkInPhone: '077', startTime: iso(41), endTime: iso(41, 11), durationMins: 4, price: 1,
    });
    expect(shortDur.status).toBe(400);
    const negPrice = await createAppt(page, {
      walkInName: 'x', walkInPhone: '077', startTime: iso(41), endTime: iso(41, 11), durationMins: 30, price: -1,
    });
    expect(negPrice.status).toBe(400);
    const badISO = await createAppt(page, {
      walkInName: 'x', walkInPhone: '077', startTime: 'tomorrow-ish', endTime: iso(41, 11), durationMins: 30, price: 1,
    });
    expect(badISO.status).toBe(400);
  });

  test('F3 — customer-linked booking resolves the patient (no walk-in fields)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const cust = await (await page.request.get(`${BASE}/api/store/customers?limit=3`)).json();
    const c0 = (cust.data?.customers ?? cust.data ?? [])[0];
    expect(c0).toBeTruthy();
    const { status, body } = await createAppt(page, {
      customerId: c0.id, startTime: iso(42), endTime: iso(42, 11), durationMins: 30, price: 1500,
    });
    expect(status).toBe(201);
    expect(body.data.customerId).toBe(c0.id);
    expect(body.data.customer?.name).toBe(c0.name);
    expect(body.data.title).toBe('Walk-in'); // no serviceId → generic default (quirk pin)
  });

  test('F4 — list envelope, startTime-asc order and zod filters (400 on hostile params)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${APPTS_API}?limit=200&dateFrom=${iso(39)}&dateTo=${iso(60)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.appointments.length).toBeGreaterThan(0);
    const times = body.data.appointments.map((a: { startTime: string }) => new Date(a.startTime).getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
    for (const bad of ['status=BOGUS', 'page=0', 'limit=201', 'dateFrom=notadate']) {
      const r = await page.request.get(`${APPTS_API}?${bad}`);
      expect(r.status(), bad).toBe(400);
    }
  });

  test('F5 — GET by id + PATCH (title/notes/price persist); unknown id → 404', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'F5', 43);
    const got = await page.request.get(`${APPTS_API}/${a.id}`);
    expect(got.status()).toBe(200);
    expect((await got.json()).data.id).toBe(a.id);
    const patched = await page.request.patch(`${APPTS_API}/${a.id}`, {
      data: { title: `${RUN} F5 edited`, notes: 'blood pressure check', price: 3000.5 },
    });
    expect(patched.status()).toBe(200);
    const pb = (await patched.json()).data;
    expect(pb.title).toBe(`${RUN} F5 edited`);
    expect(pb.notes).toBe('blood pressure check');
    expect(Number(pb.price)).toBe(3000.5);
    expect((await page.request.get(`${APPTS_API}/cuiddoesnotexist000000000`)).status()).toBe(404);
  });

  test('F6 — lifecycle: confirm → check-in → complete stamps timestamps', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'F6', 44);
    const conf = await page.request.patch(`${APPTS_API}/${a.id}`, { data: { status: 'CONFIRMED' } });
    expect(conf.status()).toBe(200);
    expect((await conf.json()).data.status).toBe('CONFIRMED');
    const ci = await page.request.post(`${APPTS_API}/${a.id}/check-in`);
    expect(ci.status()).toBe(200);
    const cib = (await ci.json()).data;
    expect(cib.status).toBe('CHECKED_IN');
    expect(cib.checkedInAt).toBeTruthy();
    expect(cib.checkedInById).toBeTruthy();
    const comp = await page.request.post(`${APPTS_API}/${a.id}/complete`);
    expect(comp.status()).toBe(200);
    const cb = (await comp.json()).data;
    expect(cb.status).toBe('COMPLETED');
    expect(cb.completedAt).toBeTruthy();
  });

  test('F7 — cancel with reason; DELETE is a soft cancel (row survives)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'F7', 45);
    const cancel = await page.request.post(`${APPTS_API}/${a.id}/cancel`, { data: { reason: 'patient fever' } });
    expect(cancel.status()).toBe(200);
    const cb = (await cancel.json()).data;
    expect(cb.status).toBe('CANCELLED');
    expect(cb.cancellationReason).toBe('patient fever');
    expect(cb.cancelledAt).toBeTruthy();
    expect(cb.cancelledById).toBeTruthy();
    // No hard delete anywhere: row still fetchable.
    const still = await page.request.get(`${APPTS_API}/${a.id}`);
    expect(still.status()).toBe(200);
    // DELETE route = cancel shorthand (soft).
    const b = await newWalkIn(page, 'F7b', 46);
    const del = await page.request.delete(`${APPTS_API}/${b.id}`);
    expect(del.status()).toBe(200);
    expect((await (await page.request.get(`${APPTS_API}/${b.id}`)).json()).data.status).toBe('CANCELLED');
  });

  test('F8 — convert-to-sale is DEAD: always 500 (BUG-85 pin) + precondition guards', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    // Non-completed → 400 guard fires first.
    const open = await newWalkIn(page, 'F8open', 47);
    const early = await page.request.post(`${APPTS_API}/${open.id}/convert-to-sale`);
    expect(early.status()).toBe(400);
    expect((await early.json()).error.code).toBe('BAD_REQUEST');
    // Completed → the sale.create crashes on shiftId:'' FK violation.
    const done = await newWalkIn(page, 'F8done', 48);
    expect((await page.request.post(`${APPTS_API}/${done.id}/complete`)).status()).toBe(200);
    const conv = await page.request.post(`${APPTS_API}/${done.id}/convert-to-sale`);
    // Defect pin: flip to 201 + sale linkage when the empty shiftId is fixed.
    expect(conv.status()).toBe(500);
    const convBody = await conv.text();
    expect(convBody).toContain('INTERNAL_SERVER_ERROR');
    // Raw Prisma/Turbopack internals leak into the client message (same class as BUG-21/42).
    expect(convBody).toMatch(/prisma|Invalid `|imported/i);
  });

  test('F9 — service catalogue CRUD with duplicate + hex-color guards', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} Consultation`;
    const created = await page.request.post(SERVICES_API, {
      data: { name, durationMins: 45, price: 2000.5, color: '#ff00aa', description: 'initial consult' },
    });
    expect(created.status()).toBe(201);
    const svc = (await created.json()).data;
    expect(Number(svc.price)).toBe(2000.5);
    expect(svc.isActive).toBe(true);
    const dup = await page.request.post(SERVICES_API, { data: { name, durationMins: 30, price: 100 } });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.code).toBe('CONFLICT');
    const badColor = await page.request.post(SERVICES_API, { data: { name: `${RUN} bad`, durationMins: 30, price: 100, color: 'red' } });
    expect(badColor.status()).toBe(400);
    const badDur = await page.request.post(SERVICES_API, { data: { name: `${RUN} bad2`, durationMins: 4, price: 100 } });
    expect(badDur.status()).toBe(400);
    const patched = await page.request.patch(`${SERVICES_API}/${svc.id}`, { data: { price: 2500 } });
    expect(patched.status()).toBe(200);
    expect(Number((await patched.json()).data.price)).toBe(2500);
    const list = await (await page.request.get(SERVICES_API)).json();
    expect(list.data.some((s: { id: string }) => s.id === svc.id)).toBe(true);
  });

  test('F10 — service soft-delete + recreate-after-soft-delete 500 (BUG-90 pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const name = `${RUN} DeleteMe`;
    const svc = (await (await page.request.post(SERVICES_API, { data: { name, durationMins: 30, price: 500 } })).json()).data;
    // Link an appointment first — delete has NO in-use guard (pin).
    const { status } = await createAppt(page, {
      walkInName: `${RUN} F10`, walkInPhone: '077', serviceId: svc.id,
      startTime: iso(49), endTime: iso(49, 11), durationMins: 30, price: 500,
    });
    expect(status).toBe(201);
    const del = await page.request.delete(`${SERVICES_API}/${svc.id}`);
    expect(del.status()).toBe(200); // in-use service deletes anyway — orphan-link pin
    const gone = await page.request.get(`${SERVICES_API}/${svc.id}`);
    expect(gone.status()).toBe(404);
    const list = await (await page.request.get(SERVICES_API)).json();
    expect(list.data.some((s: { id: string }) => s.id === svc.id)).toBe(false);
    // Defect pin: recreate with the same name → 500 (pre-check filters deletedAt, DB unique does not).
    const recreate = await page.request.post(SERVICES_API, { data: { name, durationMins: 30, price: 500 } });
    expect(recreate.status()).toBe(500);
  });

  test('F11 — slot generation is idempotent (@@unique staff/date/start)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const gen1 = await page.request.post(`${SLOTS_API}/generate`, { data: { startDate: iso(50), endDate: iso(52) } });
    expect(gen1.status()).toBe(200);
    const g1 = (await gen1.json()).data;
    expect(typeof g1.created).toBe('number');
    const gen2 = await page.request.post(`${SLOTS_API}/generate`, { data: { startDate: iso(50), endDate: iso(52) } });
    expect(gen2.status()).toBe(200);
    expect((await gen2.json()).data.created).toBe(0); // second pass creates nothing
    const bad = await page.request.post(`${SLOTS_API}/generate`, { data: { startDate: 'nope', endDate: iso(52) } });
    expect(bad.status()).toBe(400);
  });

  test('F12 — availability roster: bulk upsert + read-back', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const sid = await ownerId(page);
    const up = await page.request.post(AVAIL_API, {
      data: { staffId: sid, entries: [{ dayOfWeek: 3, startTime: '09:00', endTime: '17:00', slotDurationMins: 30 }] },
    });
    expect(up.status()).toBe(200);
    const got = await (await page.request.get(`${AVAIL_API}?staffId=${sid}`)).json();
    const wed = (got.data as Array<{ dayOfWeek: number; startTime: string }>).find((e) => e.dayOfWeek === 3);
    expect(wed).toBeTruthy();
    expect(wed?.startTime).toBe('09:00');
    const badHHMM = await page.request.post(AVAIL_API, {
      data: { staffId: sid, entries: [{ dayOfWeek: 3, startTime: '9am', endTime: '17:00' }] },
    });
    expect(badHHMM.status()).toBe(400);
    const badDay = await page.request.post(AVAIL_API, {
      data: { staffId: sid, entries: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] },
    });
    expect(badDay.status()).toBe(400);
  });

  test('F13 — time-off request → approval flow', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const sid = await ownerId(page);
    const req = await page.request.post(TIMEOFF_API, { data: { staffId: sid, date: iso(53), reason: 'annual leave' } });
    expect(req.status()).toBe(201);
    const t = (await req.json()).data;
    expect(t.isApproved).toBe(false);
    const ap = await page.request.patch(`${TIMEOFF_API}/${t.id}`, { data: { isApproved: true } });
    expect(ap.status()).toBe(200);
    expect((await ap.json()).data.isApproved).toBe(true);
    const list = await (await page.request.get(`${TIMEOFF_API}?staffId=${sid}`)).json();
    expect(list.data.some((x: { id: string }) => x.id === t.id)).toBe(true);
    const del = await page.request.delete(`${TIMEOFF_API}/${t.id}`);
    expect(del.status()).toBe(200);
  });

  test('F14 — stats envelope: total/byStatus/noShowRate/revenue', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${STATS_API}?dateFrom=${iso(39)}&dateTo=${iso(60)}`);
    expect(res.status()).toBe(200);
    const s = (await res.json()).data;
    expect(typeof s.total).toBe('number');
    expect(s.total).toBeGreaterThan(0);
    expect(typeof s.byStatus).toBe('object');
    expect(s.noShowRate).toBeGreaterThanOrEqual(0);
    expect(s.noShowRate).toBeLessThanOrEqual(100);
    expect(typeof s.revenue).toBe('number');
  });

  test('F15 — UI calendar renders view toggles; list page opens the booking dialog', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(`${BASE}/appointments`);
    // Buttons render lowercase text ({v}) with CSS text-transform:capitalize — match case-insensitively.
    for (const v of ['day', 'week', 'month']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${v}$`, 'i') })).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    await page.getByRole('button', { name: /^month$/i }).click();
    await expect(page.getByRole('button', { name: /^month$/i })).toBeVisible();
    await page.goto(`${BASE}/appointments/list`);
    const newBtn = page.getByRole('button', { name: /new appointment/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 20_000 });
    await newBtn.click();
    await expect(page.getByRole('heading', { name: /new appointment/i })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  // ─── §2 Financial & LKR Precision ─────────────────────────────────────
  test('P1 — price Decimal(10,2): 100.456 → 100.46; depositAmount defaults 0', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const { status, body } = await createAppt(page, {
      walkInName: `${RUN} P1`, walkInPhone: '077', startTime: iso(54), endTime: iso(54, 11), durationMins: 30, price: 100.456,
    });
    expect(status).toBe(201);
    expect(Number(body.data.price).toFixed(2)).toBe('100.46');
    expect(Number(body.data.depositAmount)).toBe(0);
    const dep = await createAppt(page, {
      walkInName: `${RUN} P1b`, walkInPhone: '077', startTime: iso(54, 14), endTime: iso(54, 15), durationMins: 30, price: 999.994, depositAmount: 500.5,
    });
    expect(Number(dep.body.data.depositAmount)).toBe(500.5);
  });

  test('P2 — int4-exceeding price → 500 numeric overflow (BUG-91 pin: zod min(0) has no max)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const { status, body } = await createAppt(page, {
      walkInName: `${RUN} P2`, walkInPhone: '077', startTime: iso(55), endTime: iso(55, 11), durationMins: 30, price: 1e12,
    });
    // Decimal(10,2) caps at 99,999,999.99 — flip to 400 when a zod .max() lands.
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  // ─── §3 Cross-Module Cascade & Ledger Impact ──────────────────────────
  test('L1 — staff overlap guard: same-staff double-book → 409; cancelled frees the window', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const sid = await ownerId(page);
    // Hour 20 window: no other test books staff at 20:00, so leftovers from failed runs
    // (hours 10–17) can never false-collide with the overlap assertions.
    const a = await createAppt(page, {
      walkInName: `${RUN} L1a`, walkInPhone: '077', staffId: sid, startTime: iso(DAY_BASE + 26, 20), endTime: iso(DAY_BASE + 26, 21), durationMins: 60, price: 1000,
    });
    expect(a.status).toBe(201);
    const b = await createAppt(page, {
      walkInName: `${RUN} L1b`, walkInPhone: '077', staffId: sid, startTime: iso(DAY_BASE + 26, 20), endTime: iso(DAY_BASE + 26, 21), durationMins: 60, price: 1000,
    });
    expect(b.status).toBe(409);
    expect(b.body.error.code).toBe('CONFLICT');
    // Cancel A → the window frees (CANCELLED excluded from the overlap predicate).
    expect((await page.request.post(`${APPTS_API}/${a.body.data.id}/cancel`, { data: {} })).status()).toBe(200);
    const c = await createAppt(page, {
      walkInName: `${RUN} L1c`, walkInPhone: '077', staffId: sid, startTime: iso(DAY_BASE + 26, 20), endTime: iso(DAY_BASE + 26, 21), durationMins: 60, price: 1000,
    });
    expect(c.status).toBe(201);
  });

  test('L2 — audit trail: CREATE + CANCEL rows land for appointment actions', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'L2', 57);
    expect((await page.request.post(`${APPTS_API}/${a.id}/cancel`, { data: { reason: 'audit probe' } })).status()).toBe(200);
    const feed = await (await page.request.get(`${AUDIT_API}?entityType=Appointment&pageSize=100`)).json();
    const rows = auditRows(feed);
    expect(rows.some((r) => r.entityId === a.id && r.action === 'CREATE')).toBe(true);
    expect(rows.some((r) => r.entityId === a.id && r.action === 'CANCEL')).toBe(true);
  });

  test('A1 — PATCH/check-in/complete write NO audit rows (pin: trail gap)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'A1', 58);
    const feedBefore = await (await page.request.get(`${AUDIT_API}?entityType=Appointment&pageSize=100`)).json();
    const before = auditRows(feedBefore);
    await page.request.patch(`${APPTS_API}/${a.id}`, { data: { notes: 'unaudited edit' } });
    await page.request.post(`${APPTS_API}/${a.id}/check-in`);
    await page.request.post(`${APPTS_API}/${a.id}/complete`);
    const feedAfter = await (await page.request.get(`${AUDIT_API}?entityType=Appointment&pageSize=100`)).json();
    const after = auditRows(feedAfter);
    // Only the CREATE row from this test exists for the id — no UPDATE/CHECK_IN/COMPLETE actions.
    const mine = after.filter((r) => r.entityId === a.id);
    expect(mine.map((r) => r.action).sort()).toEqual(['CREATE']);
    expect(after.length).toBe(before.length);
  });

  test('A2 — audit actorRole hardcoded OWNER even when CASHIER is the actor (BUG-93 pin)', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const { status, body } = await createAppt(page, {
      walkInName: `${RUN} A2`, walkInPhone: '077', startTime: iso(59), endTime: iso(59, 11), durationMins: 30, price: 100,
    });
    expect(status).toBe(201);
    await login(page, OWNER.email, OWNER.password);
    const feed = await (await page.request.get(`${AUDIT_API}?entityType=Appointment&pageSize=100`)).json();
    const rows = auditRows(feed);
    const mine = rows.find((r) => r.entityId === body.data.id && r.action === 'CREATE');
    expect(mine).toBeTruthy();
    expect(mine?.actorId).toBe(body.data.createdById); // cashier acted
    // Defect pin: flip to 'CASHIER' when the hardcoded actorRole:'OWNER' is removed.
    expect(mine?.actorRole).toBe('OWNER');
  });

  // ─── §5 Race Conditions & Idempotency ─────────────────────────────────
  test('R1 — double-cancel is idempotent (200/200, still CANCELLED)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'R1', 60);
    const c1 = await page.request.post(`${APPTS_API}/${a.id}/cancel`, { data: { reason: 'first' } });
    const c2 = await page.request.post(`${APPTS_API}/${a.id}/cancel`, { data: { reason: 'second' } });
    expect(c1.status()).toBe(200);
    expect(c2.status()).toBe(200);
    expect((await (await page.request.get(`${APPTS_API}/${a.id}`)).json()).data.status).toBe('CANCELLED');
  });

  test('R2 — 3 concurrent same-staff bookings ALL succeed → double-book race (BUG-92 pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const sid = await ownerId(page);
    const payload: ApptInput = {
      walkInName: `${RUN} R2`, walkInPhone: '077', staffId: sid, startTime: iso(DAY_BASE + 31, 20), endTime: iso(DAY_BASE + 31, 21), durationMins: 60, price: 100,
    };
    const results = await Promise.all([
      createAppt(page, payload),
      createAppt(page, { ...payload, walkInName: `${RUN} R2b` }),
      createAppt(page, { ...payload, walkInName: `${RUN} R2c` }),
    ]);
    // Defect pin: the findFirst→create overlap check is non-atomic. Flip to exactly one 201
    // (rest 409) when the guard moves into a transaction/unique constraint.
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
  });

  test('R3 — concurrent reads (list/stats/services) all 200 with consistent totals', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const [l1, l2, s1, sv] = await Promise.all([
      page.request.get(`${APPTS_API}?limit=5`),
      page.request.get(`${APPTS_API}?limit=5`),
      page.request.get(STATS_API),
      page.request.get(SERVICES_API),
    ]);
    for (const r of [l1, l2, s1, sv]) expect(r.status()).toBe(200);
    expect((await l1.json()).data.total).toBe((await l2.json()).data.total);
  });

  // ─── §6 Hardware & Device Simulation ──────────────────────────────────
  test('H1 — mobile viewport (390px): calendar renders without horizontal overflow', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/appointments`);
    await expect(page.getByRole('button', { name: /^week$/i }).first()).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(4);
  });

  // ─── §7 Network Resilience & Graceful Degradation ─────────────────────
  test('N1 — malformed JSON body → 400 (not 500)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.post(APPTS_API, { data: '{oops', headers: { 'content-type': 'application/json' } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  test('N2 — stats/slots/time-off malformed date params → 500 (BUG-89 pin: new Date() unvalidated)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const st = await page.request.get(`${STATS_API}?dateFrom=notadate`);
    expect(st.status()).toBe(500); // flip to 400 when date zod parsing lands
    const sl = await page.request.get(`${SLOTS_API}?date=notadate`);
    expect(sl.status()).toBe(500);
    const to = await page.request.get(`${TIMEOFF_API}?dateFrom=notadate`);
    expect(to.status()).toBe(500);
    // Contrast: slots WITHOUT the param is correctly 400.
    expect((await page.request.get(SLOTS_API)).status()).toBe(400);
  });

  test('N3 — mocked 500 on the appointments feed → UI survives', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/appointments**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'boom' } }) }),
    );
    await page.goto(`${BASE}/appointments/list`);
    // No crash dialog / white screen — the shell (nav or content) is still mounted.
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/appointments/list');
    await page.unroute('**/api/store/appointments**');
  });

  // ─── §8 Security, RBAC & Multi-Tenant Isolation ───────────────────────
  test('S1 — unauthenticated → 401 on every appointment surface', async ({ page }) => {
    for (const url of [APPTS_API, SERVICES_API, SLOTS_API + '?date=' + iso(2).slice(0, 10), AVAIL_API, TIMEOFF_API, REMINDERS_API + '?appointmentId=x', STATS_API]) {
      const res = await page.request.get(url);
      expect(res.status(), url).toBe(401);
    }
    expect((await page.request.post(APPTS_API, { data: {} })).status()).toBe(401);
  });

  test('S2 — CASHIER: view/create/check-in allowed; edit/cancel/services/schedule 403', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    expect((await page.request.get(APPTS_API)).status()).toBe(200);
    const a = await createAppt(page, {
      walkInName: `${RUN} S2`, walkInPhone: '077', startTime: iso(62), endTime: iso(62, 11), durationMins: 30, price: 100,
    });
    expect(a.status).toBe(201);
    expect((await page.request.post(`${APPTS_API}/${a.body.data.id}/check-in`)).status()).toBe(200);
    expect((await page.request.patch(`${APPTS_API}/${a.body.data.id}`, { data: { notes: 'x' } })).status()).toBe(403);
    expect((await page.request.post(`${APPTS_API}/${a.body.data.id}/cancel`, { data: {} })).status()).toBe(403);
    expect((await page.request.post(SERVICES_API, { data: { name: `${RUN} s2svc`, durationMins: 30, price: 100 } })).status()).toBe(403);
    expect((await page.request.post(`${SLOTS_API}/generate`, { data: { startDate: iso(63), endDate: iso(64) } })).status()).toBe(403);
    expect((await page.request.post(TIMEOFF_API, { data: { staffId: 'x', date: iso(63) } })).status()).toBe(403);
  });

  test('S3 — complete/no-show/convert have NO permission gate (BUG-86 pin: CASHIER 200s)', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const a = await newWalkIn(page, 'S3', 65);
    // Defect pins: flip to 403 when the routes gain hasPermission checks.
    expect((await page.request.post(`${APPTS_API}/${a.id}/complete`)).status()).toBe(200);
    const b = await newWalkIn(page, 'S3b', 66);
    expect((await page.request.post(`${APPTS_API}/${b.id}/no-show`)).status()).toBe(200);
    const c = await newWalkIn(page, 'S3c', 67);
    await page.request.post(`${APPTS_API}/${c.id}/complete`);
    // Convert is auth-only too — reaches the 500 crash, not a 403.
    expect((await page.request.post(`${APPTS_API}/${c.id}/convert-to-sale`)).status()).toBe(500);
  });

  test('S4 — DISPATCH 403 (no appointment perms); SUPER_ADMIN 401 (no tenant)', async ({ page }) => {
    await login(page, DISPATCH.email, DISPATCH.password);
    expect((await page.request.get(APPTS_API)).status()).toBe(403);
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const res = await page.request.get(APPTS_API);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.message).toMatch(/no tenant/i);
  });

  test('S5 — cross-tenant: foreign owner gets 404 on dilani appointments', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'S5', 68);
    await login(page, FOREIGN_OWNER.email, FOREIGN_OWNER.password);
    expect((await page.request.get(`${APPTS_API}/${a.id}`)).status()).toBe(404);
    expect((await page.request.patch(`${APPTS_API}/${a.id}`, { data: { notes: 'hijack' } })).status()).toBe(404);
    expect((await page.request.post(`${APPTS_API}/${a.id}/cancel`, { data: {} })).status()).toBe(404);
    const list = await (await page.request.get(`${APPTS_API}?limit=100`)).json();
    expect(list.data.appointments.every((x: { id: string }) => x.id !== a.id)).toBe(true);
  });

  test('S6 — reminders route has NO tenant scoping (BUG-87 IDOR pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'S6', 69);
    await login(page, FOREIGN_OWNER.email, FOREIGN_OWNER.password);
    // Defect pin: foreign tenant reading another tenant's reminder history by appointment id.
    // Flip to 403/404 when getReminderHistory gains a tenantId filter.
    const res = await page.request.get(`${REMINDERS_API}?appointmentId=${a.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
    // Missing param → 400; unknown id → 200 [] (no 404 — enumeration-tolerant pin).
    expect((await page.request.get(REMINDERS_API)).status()).toBe(400);
    expect((await page.request.get(`${REMINDERS_API}?appointmentId=nope`)).status()).toBe(200);
  });

  test('S7 — public booking: unauthenticated 201 lands in the tenant feed', async ({ page }) => {
    const pub = await page.request.post(PUBLIC_BOOK_API, {
      data: { walkInName: `${RUN} PUBLIC`, walkInPhone: '0779876543', startTime: iso(70), endTime: iso(70, 11), durationMins: 30, price: 1200 },
    });
    expect(pub.status()).toBe(201);
    const created = (await pub.json()).data;
    expect(created.walkInName).toBe(`${RUN} PUBLIC`);
    await login(page, OWNER.email, OWNER.password);
    const list = await (await page.request.get(`${APPTS_API}?limit=200&dateFrom=${iso(69)}&dateTo=${iso(71)}`)).json();
    expect(list.data.appointments.some((x: { id: string }) => x.id === created.id)).toBe(true);
    // Unknown tenant → 404; validation still applies.
    expect((await page.request.post(PUBLIC_BOOK_BAD_API, { data: { walkInName: 'x', walkInPhone: '077', startTime: iso(70), endTime: iso(70, 11), durationMins: 30, price: 1 } })).status()).toBe(404);
    expect((await page.request.post(PUBLIC_BOOK_API, { data: { walkInName: '' } })).status()).toBe(400);
  });

  test('S8 — time-off GET has no permission gate (OBS-80 pin: any session reads the roster)', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const res = await page.request.get(TIMEOFF_API);
    // Pin: auth-only. Flip to 403 if the roster is meant to be manager-visible only.
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  // ─── §9 Boundary Inputs, Chaos & Unicode ──────────────────────────────
  test('X1 — Sinhala/Tamil/emoji in patient name, title and notes round-trip', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const { status, body } = await createAppt(page, {
      walkInName: `${RUN} නම-ilaki-🩺`, walkInPhone: '077', title: 'அவசரம் check-up ✅',
      notes: 'සිංහල note — Tamil கோப்பு — <b>bold</b>',
      startTime: iso(71), endTime: iso(71, 11), durationMins: 30, price: 100,
    });
    expect(status).toBe(201);
    expect(body.data.title).toBe('அவசரம் check-up ✅');
    expect(body.data.notes).toContain('සිංහල');
    const got = await (await page.request.get(`${APPTS_API}/${body.data.id}`)).json();
    expect(got.data.walkInName).toBe(`${RUN} නම-ilaki-🩺`);
  });

  test('X2 — script payload in title stored VERBATIM by the API (BUG-94 pin), inert in React UI', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const { body } = await createAppt(page, {
      walkInName: `${RUN} X2`, walkInPhone: '077', title: '<script>alert(1)</script>',
      startTime: iso(72), endTime: iso(72, 11), durationMins: 30, price: 100,
    });
    const raw = await (await page.request.get(`${APPTS_API}/${body.data.id}`)).text();
    // Defect pin: the API returns the raw tag verbatim — same unsanitized-storage class as
    // BUG-76/77. Safe TODAY only because no appointment component uses dangerouslySetInnerHTML
    // (grep-verified) and React escapes interpolation. Flip when the API sanitizes.
    expect(raw).toContain('<script>alert(1)</script>');
    await page.goto(`${BASE}/appointments/list`);
    // UI renders it as inert literal text — no dialog, no crash.
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/appointments/list');
  });

  test('X3 — boundary strings: 100-char name ok, 101 rejected; 200-char title ok, 201 rejected', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const ok = await createAppt(page, {
      walkInName: 'N'.repeat(100), walkInPhone: 'P'.repeat(20), title: 'T'.repeat(200),
      startTime: iso(73), endTime: iso(73, 11), durationMins: 30, price: 100,
    });
    expect(ok.status).toBe(201);
    const over = await createAppt(page, {
      walkInName: 'N'.repeat(101), walkInPhone: '077', startTime: iso(73, 14), endTime: iso(73, 15), durationMins: 30, price: 100,
    });
    expect(over.status).toBe(400);
    const overPhone = await createAppt(page, {
      walkInName: 'N', walkInPhone: '0'.repeat(21), startTime: iso(73, 16), endTime: iso(73, 17), durationMins: 30, price: 100,
    });
    expect(overPhone.status).toBe(400);
  });

  test('X4 — PATCH cannot smuggle unknown fields or forged ids', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await newWalkIn(page, 'X4', 74);
    const res = await page.request.patch(`${APPTS_API}/${a.id}`, {
      data: { notes: 'legit', tenantId: 'OTHER-TENANT-ID', id: 'forged', createdById: 'forged', saleId: 'forged' },
    });
    expect(res.status()).toBe(200);
    const b = (await res.json()).data;
    expect(b.tenantId).toBe(a.tenantId); // session-scoped, never client-controlled
    expect(b.id).toBe(a.id);
    expect(b.createdById).toBe(a.createdById);
    expect(b.saleId).toBeNull();
  });

  // ─── §10 Time-Travel & Retroactive Semantics ──────────────────────────
  test('T1 — backdated booking accepted (OBS-79 pin: no past-date guard)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const { status, body } = await createAppt(page, {
      walkInName: `${RUN} T1`, walkInPhone: '077', startTime: iso(-10), endTime: iso(-10, 11), durationMins: 30, price: 100,
    });
    // Pin: req 3.3 lists no retroactive-booking rule — flip to 400 if the client demands one.
    expect(status).toBe(201);
    expect(new Date(body.data.startTime).getTime()).toBeLessThan(Date.now());
  });

  test('T2 — stats window: dateFrom/dateTo bound the population (retro rows counted)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const all = await (await page.request.get(STATS_API)).json();
    const windowed = await (await page.request.get(`${STATS_API}?dateFrom=${iso(39)}&dateTo=${iso(60)}`)).json();
    expect(windowed.data.total).toBeLessThanOrEqual(all.data.total);
    expect(windowed.data.total).toBeGreaterThan(0);
  });

  test('T3 — list pagination windows are deterministic (page 1 == page 1 across calls)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const range = `dateFrom=${iso(39)}&dateTo=${iso(75)}`;
    const a = await (await page.request.get(`${APPTS_API}?limit=10&${range}`)).json();
    const b = await (await page.request.get(`${APPTS_API}?limit=10&${range}`)).json();
    expect(a.data.appointments.map((x: { id: string }) => x.id)).toEqual(b.data.appointments.map((x: { id: string }) => x.id));
    expect(a.data.page).toBe(1);
    expect(a.data.limit).toBe(10);
  });

  // ─── §0 Cleanup ───────────────────────────────────────────────────────
  test('Z1 — cleanup: cancel every qa-m27 walk-in booking created by this suite (any run)', async ({ page }) => {
    test.setTimeout(300_000);
    await login(page, OWNER.email, OWNER.password);
    let cancelled = 0;
    const seen = new Set<string>();
    const windows: Array<[number, number]> = [[-35, 75], [DAY_BASE + 20, DAY_BASE + 35]];
    for (const [from, to] of windows) {
      const list = await (await page.request.get(`${APPTS_API}?limit=200&dateFrom=${iso(from, 0)}&dateTo=${iso(to, 23)}`)).json();
      for (const a of list.data.appointments as Array<{ id: string; status: string; walkInName?: string | null; title?: string }>) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        const isMine = (a.walkInName ?? '').startsWith('qa-m27') || (a.title ?? '').startsWith('qa-m27');
        if (isMine && a.status !== 'CANCELLED') {
          try {
            const r = await page.request.post(`${APPTS_API}/${a.id}/cancel`, { data: { reason: 'QA cleanup' }, timeout: 15_000 });
            if (r.status() === 200) cancelled += 1;
          } catch {
            /* best-effort sweep — leftovers are inert CANCELLED-safe rows */
          }
        }
      }
    }
    console.log(`M27_CLEANUP run=${RUN} scanned=${seen.size} cancelled=${cancelled}`);
    expect(cancelled).toBeGreaterThanOrEqual(0);
  });
});
