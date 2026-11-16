/* eslint-disable no-console -- CLI prints the fixture table for manual checking */
/**
 * Demo fixtures for the courier-statement comparison (Feature update #12).
 *
 * Seeds one delivery per comparison outcome and writes a matching Excel
 * statement the operator can upload at /delivery/reconciliation:
 *
 *   references (repo root): REFERENCES/reconciliation-demo-statement.xlsx
 *
 * Usage (from `erp/`):
 *
 *   node --env-file=.env --import tsx scripts/reconciliation-demo-seed.ts
 *   node --env-file=.env --import tsx scripts/reconciliation-demo-seed.ts --cleanup
 *
 * Everything is tagged `RECON-DEMO-` in `orderRef`, so `--cleanup` removes only
 * these records. Re-running the seed first removes the previous copy.
 *
 * The fixtures live in the *current* month so the page's default date range
 * (this month) works immediately; one statement row is dated last month to
 * demonstrate the "outside range" counter.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import * as XLSX from 'xlsx';

import { PrismaClient } from '../src/generated/prisma/client';

const PREFIX = 'RECON-DEMO-';
const WAYBILL_PREFIX = 'BA91';
const OUT_DIR = path.resolve(process.cwd(), '..', 'REFERENCES');
const OUT_FILE = path.join(OUT_DIR, 'reconciliation-demo-statement.xlsx');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Dates: this month, so the page's default range covers them ──────────────

const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth(); // 0-based

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDay(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

const thisMonth = (day: number) => isoDay(YEAR, MONTH, day);
const deliveredAt = (day: number) => `${thisMonth(day)}T10:00:00.000Z`;
const lastMonth = new Date(Date.UTC(YEAR, MONTH, 0));
const LAST_MONTH_DAY = isoDay(
  lastMonth.getUTCFullYear(),
  lastMonth.getUTCMonth(),
  lastMonth.getUTCDate(),
);

// ── Deliveries ──────────────────────────────────────────────────────────────

interface DemoDelivery {
  key: string;
  orderRef: string;
  waybill: string | null;
  cod: number;
  fee: number;
  status: 'DELIVERED' | 'PLACED' | 'DISPATCHED';
  deliveredDay: number | null;
  /** What the operator should see for this record in the comparison. */
  expectation: string;
}

const DELIVERIES: DemoDelivery[] = [
  {
    key: 'MATCH',
    orderRef: `${PREFIX}MATCH`,
    waybill: `${WAYBILL_PREFIX}0001`,
    cod: 3900,
    fee: 475,
    status: 'DELIVERED',
    deliveredDay: 3,
    expectation: 'Matched — COD, charge and status agree.',
  },
  {
    key: 'COD-SHORT',
    orderRef: `${PREFIX}COD-SHORT`,
    waybill: `${WAYBILL_PREFIX}0002`,
    cod: 3900,
    fee: 475,
    status: 'DELIVERED',
    deliveredDay: 4,
    expectation: 'COD mismatch — statement collected 3425 (short by 475).',
  },
  {
    key: 'FEE',
    orderRef: `${PREFIX}FEE`,
    waybill: `${WAYBILL_PREFIX}0003`,
    cod: 2500,
    fee: 400,
    status: 'DELIVERED',
    deliveredDay: 5,
    expectation: 'Charge mismatch — statement delivery charge 475 vs 400 (+75).',
  },
  {
    key: 'STATUS',
    orderRef: `${PREFIX}STATUS`,
    waybill: `${WAYBILL_PREFIX}0004`,
    cod: 1500,
    fee: 350,
    status: 'DELIVERED',
    deliveredDay: 6,
    expectation: 'Status mismatch — statement still says "Pending".',
  },
  {
    key: 'MISSING-IN-STATEMENT',
    orderRef: `${PREFIX}MISSING`,
    waybill: `${WAYBILL_PREFIX}0005`,
    cod: 5000,
    fee: 500,
    status: 'DELIVERED',
    deliveredDay: 7,
    expectation: 'Missing in statement — no row exists in the sheet.',
  },
  {
    key: 'ORDER-REF-FALLBACK',
    orderRef: `${PREFIX}ORDER-FALLBACK`,
    waybill: null,
    cod: 2200,
    fee: 350,
    status: 'DELIVERED',
    deliveredDay: 8,
    expectation: 'Matched via ORDER NO fallback — system waybill is empty.',
  },
  {
    key: 'DUPLICATE',
    orderRef: `${PREFIX}DUP`,
    waybill: `${WAYBILL_PREFIX}0006`,
    cod: 1800,
    fee: 300,
    status: 'DELIVERED',
    deliveredDay: 9,
    expectation: 'Matched, plus a duplicate-row warning for the repeated waybill.',
  },
  {
    key: 'NO-WAYBILL',
    orderRef: `${PREFIX}NO-WAYBILL`,
    waybill: null,
    cod: 1200,
    fee: 300,
    status: 'DELIVERED',
    deliveredDay: 10,
    expectation: 'Missing in statement — no waybill and no sheet row to fall back to.',
  },
  // Not delivered yet: these must never appear in the comparison.
  {
    key: 'PLACED',
    orderRef: `${PREFIX}PLACED`,
    waybill: `${WAYBILL_PREFIX}0009`,
    cod: 1000,
    fee: 200,
    status: 'PLACED',
    deliveredDay: null,
    expectation: 'Excluded — not delivered yet.',
  },
  {
    key: 'DISPATCHED',
    orderRef: `${PREFIX}DISPATCHED`,
    waybill: `${WAYBILL_PREFIX}0010`,
    cod: 1000,
    fee: 200,
    status: 'DISPATCHED',
    deliveredDay: null,
    expectation: 'Excluded — still in transit.',
  },
];

// ── Statement workbook ──────────────────────────────────────────────────────

const HEADER = [
  'ORDER DATE',
  'WAYBILL ID',
  'INVOICE NO',
  'ORDER NO',
  'VAT %',
  'COMMISSION',
  'COD',
  'COLLECTED COD',
  'TOTAL VAT',
  'TOTAL COMMISSION',
  'DELIVERY CHARGE',
  'PAYABLE',
  'WEIGHT (KG)',
  'STATUS',
];

type SheetRow = Record<string, string | number>;

function row(
  date: string,
  waybill: string,
  orderNo: string,
  collected: number,
  charge: number,
  status = 'Delivered',
): SheetRow {
  return {
    'ORDER DATE': date,
    'WAYBILL ID': waybill,
    'INVOICE NO': 'TRA-DEMO-0001',
    'ORDER NO': orderNo,
    'VAT %': 0,
    COMMISSION: 0,
    COD: collected,
    'COLLECTED COD': collected,
    'TOTAL VAT': 0,
    'TOTAL COMMISSION': 0,
    'DELIVERY CHARGE': charge,
    PAYABLE: collected - charge,
    'WEIGHT (KG)': 1,
    STATUS: status,
  };
}

function statementRows(): SheetRow[] {
  return [
    // 1. Clean match.
    row(thisMonth(3), `${WAYBILL_PREFIX}0001`, `${PREFIX}MATCH`, 3900, 475),
    // 2. Collected less than the system COD.
    row(thisMonth(4), `${WAYBILL_PREFIX}0002`, `${PREFIX}COD-SHORT`, 3425, 475),
    // 3. Courier charged more than the system shipping fee.
    row(thisMonth(5), `${WAYBILL_PREFIX}0003`, `${PREFIX}FEE`, 2500, 475),
    // 4. Courier still reports the order as pending.
    row(thisMonth(6), `${WAYBILL_PREFIX}0004`, `${PREFIX}STATUS`, 1500, 350, 'Pending'),
    // 5. No waybill in our system: match on ORDER NO instead.
    row(thisMonth(8), ' ', `${PREFIX}ORDER-FALLBACK`, 2200, 350),
    // 6 + 7. Same waybill twice → duplicate warning.
    row(thisMonth(9), `${WAYBILL_PREFIX}0006`, `${PREFIX}DUP`, 1800, 300),
    row(thisMonth(9), `${WAYBILL_PREFIX}0006`, `${PREFIX}DUP`, 1800, 300),
    // 8. In the sheet but never in our system.
    row(thisMonth(11), `${WAYBILL_PREFIX}0007`, 'UNKNOWN-DEMO-ORDER', 4500, 500),
    // 9. Neither waybill nor order reference → cannot be matched.
    row(thisMonth(12), ' ', ' ', 900, 0),
    // 10. Outside the selected month → counted, not compared.
    row(LAST_MONTH_DAY, `${WAYBILL_PREFIX}0008`, 'OUTSIDE-DEMO-ORDER', 3300, 400),
  ];
}

function writeWorkbook(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(statementRows(), { header: HEADER }),
    'Invoice Details',
  );

  // Second sheet only: the comparison parser reads the first sheet, so this
  // does not affect the result — it is the manual-check script.
  const guide: string[][] = [
    ['Scenario', 'Seeded delivery / statement row', 'Expected comparison result'],
    ...DELIVERIES.map((item) => [
      item.key,
      `${item.orderRef}${item.waybill ? ` / ${item.waybill}` : ''}`,
      item.expectation,
    ]),
    [
      'MISSING-IN-SYSTEM',
      `${WAYBILL_PREFIX}0007 / UNKNOWN-DEMO-ORDER (sheet only)`,
      'Not in our system.',
    ],
    [
      'MISSING-WAYBILL',
      'Row with no WAYBILL ID and no ORDER NO',
      'No waybill — cannot be matched.',
    ],
    [
      'OUTSIDE-RANGE',
      `${WAYBILL_PREFIX}0008 dated ${LAST_MONTH_DAY}`,
      'Counted as outside the selected period.',
    ],
    ['', '', ''],
    ['Expected totals', 'Value', ''],
    ['System deliveries in range', String(DELIVERIES.filter((d) => d.status === 'DELIVERED').length), ''],
    ['Matched', '3', 'MATCH, ORDER-REF-FALLBACK, DUPLICATE'],
    ['Differences', '8', '2 missing in statement, 1 missing in system, 1 no waybill, 1 duplicate, 1 COD, 1 fee, 1 status'],
    ['System COD total', '22000.00', ''],
    ['Statement COD total', '19825.00', 'Canonical rows only'],
    ['Variance', '-2175.00', 'Statement minus system'],
    ['', '', ''],
    ['Tip', 'Clear the previous result with the Reset button before uploading this sheet.', ''],
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(guide),
    'Expected results',
  );

  XLSX.writeFile(workbook, OUT_FILE);
  console.log(`\nWrote ${OUT_FILE}`);
}

// ── Seed / cleanup ──────────────────────────────────────────────────────────

interface TenantRef {
  id: string;
  slug: string;
  name: string;
}

/**
 * Resolves the target tenant. `--tenant <slug>` wins; otherwise the single
 * tenant in the database is used, falling back to the demo slug `dilani`.
 */
async function resolveTenant(): Promise<TenantRef> {
  const index = process.argv.findIndex(
    (arg) => arg === '--tenant' || arg.startsWith('--tenant='),
  );
  let slug: string | undefined;
  if (index >= 0) {
    const arg = process.argv[index]!;
    slug = arg.includes('=') ? arg.split('=')[1] : process.argv[index + 1];
  }

  if (slug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!tenant) throw new Error(`Tenant slug "${slug}" not found`);
    return tenant;
  }

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true },
    take: 2,
  });
  if (tenants.length === 1) return tenants[0]!;

  const dilani = await prisma.tenant.findUnique({
    where: { slug: 'dilani' },
    select: { id: true, slug: true, name: true },
  });
  if (dilani) return dilani;

  throw new Error('Multiple tenants found; pass --tenant <slug>');
}

async function cleanup(): Promise<number> {
  const tenant = await resolveTenant();

  const deliveries = await prisma.delivery.findMany({
    where: { tenantId: tenant.id, orderRef: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = deliveries.map((delivery) => delivery.id);
  if (ids.length === 0) return 0;

  await prisma.reconciliationDispute.deleteMany({
    where: { ledgerEntry: { deliveryId: { in: ids } } },
  });
  await prisma.reconciliationLedgerEntry.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.deliveryEvent.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.courierShipment.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.deliveryLine.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.package.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.packagingConsumption.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.deliveryRecovery.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.delivery.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function seed(): Promise<void> {
  const tenant = await resolveTenant();

  const removed = await cleanup();
  if (removed > 0) console.log(`Removed ${removed} previous ${PREFIX} deliveries.`);

  for (const item of DELIVERIES) {
    const delivery = await prisma.delivery.create({
      data: {
        tenantId: tenant.id,
        source: 'ERP_MANUAL',
        status: item.status,
        orderRef: item.orderRef,
        codAmount: item.cod,
        shippingFee: item.fee,
        itemCount: 1,
        totalWeightKg: 1,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        deliveredAt: item.deliveredDay ? new Date(deliveredAt(item.deliveredDay)) : null,
        dispatchedAt: item.status === 'DISPATCHED' ? new Date(deliveredAt(2)) : null,
        notes: `Demo fixture for statement comparison — remove with scripts/reconciliation-demo-seed.ts --cleanup`,
      },
    });

    if (item.waybill) {
      await prisma.courierShipment.create({
        data: {
          tenantId: tenant.id,
          deliveryId: delivery.id,
          waybillId: item.waybill,
          status: 'SUBMITTED',
        },
      });
    }
  }

  console.log(
    `Seeded ${DELIVERIES.length} ${PREFIX} deliveries for tenant ${tenant.slug} (${tenant.name}):`,
  );
  for (const item of DELIVERIES) {
    console.log(
      `  ${item.status.padEnd(10)} ${item.orderRef.padEnd(30)} ${(item.waybill ?? '—').padEnd(
        10,
      )} COD ${item.cod}`,
    );
  }
  writeWorkbook();
  console.log(
    '\nUpload REFERENCES/reconciliation-demo-statement.xlsx on /delivery/reconciliation and press Compare.\n',
  );
}

const isCleanup = process.argv.includes('--cleanup');

(isCleanup
  ? cleanup().then((count) =>
      console.log(`Removed ${count} ${PREFIX} deliver${count === 1 ? 'y' : 'ies'}.`),
    )
  : seed()
)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
