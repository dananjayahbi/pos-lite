/* eslint-disable no-console -- QA CLI reports what it seeded and wrote */
/**
 * QA fixtures for the courier-statement comparison (Atlas Issue #22).
 *
 * Creates deliveries in several states for the Ayur Wellness tenant and writes
 * matching Excel statements under `test-artifacts/reconciliation/`, so the
 * /delivery/reconciliation page can be exercised end to end against real data.
 *
 * Everything is tagged `QA-RECON-` so it can be removed again:
 *
 *   node --env-file=.env --import tsx scripts/qa-reconciliation-seed.ts
 *   node --env-file=.env --import tsx scripts/qa-reconciliation-seed.ts --cleanup
 *
 * The deliveries are deliberately dated July 2026: the real reference sheet
 * (`REFERENCES/InvoiceDetails (1).xlsx`) is also July 2026, which lets the same
 * fixtures reproduce the "uploaded sheet is outside the selected month" bug.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import * as XLSX from 'xlsx';

import { PrismaClient } from '../src/generated/prisma/client';

const PREFIX = 'QA-RECON-';
const OUT_DIR = path.resolve(process.cwd(), 'test-artifacts', 'reconciliation');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface Scenario {
  orderRef: string;
  waybill: string | null;
  cod: number;
  fee: number;
  status: 'DELIVERED' | 'PLACED' | 'DISPATCHED';
  deliveredAt: string | null;
}

const DELIVERIES: Scenario[] = [
  { orderRef: `${PREFIX}MATCH`, waybill: 'BA900001', cod: 3900, fee: 475, status: 'DELIVERED', deliveredAt: '2026-07-13T10:00:00.000Z' },
  { orderRef: `${PREFIX}COD-SHORT`, waybill: 'BA900002', cod: 3900, fee: 475, status: 'DELIVERED', deliveredAt: '2026-07-14T10:00:00.000Z' },
  { orderRef: `${PREFIX}FEE`, waybill: 'BA900003', cod: 2500, fee: 400, status: 'DELIVERED', deliveredAt: '2026-07-15T10:00:00.000Z' },
  { orderRef: `${PREFIX}STATUS`, waybill: 'BA900004', cod: 1500, fee: 350, status: 'DELIVERED', deliveredAt: '2026-07-16T10:00:00.000Z' },
  { orderRef: `${PREFIX}NOT-IN-STMT`, waybill: 'BA900005', cod: 5000, fee: 500, status: 'DELIVERED', deliveredAt: '2026-07-17T10:00:00.000Z' },
  { orderRef: `${PREFIX}NO-WAYBILL`, waybill: null, cod: 1200, fee: 300, status: 'DELIVERED', deliveredAt: '2026-07-18T10:00:00.000Z' },
  { orderRef: `${PREFIX}ORDER-FALLBACK`, waybill: null, cod: 2200, fee: 350, status: 'DELIVERED', deliveredAt: '2026-07-19T10:00:00.000Z' },
  { orderRef: `${PREFIX}DUP`, waybill: 'BA900006', cod: 1800, fee: 300, status: 'DELIVERED', deliveredAt: '2026-07-20T10:00:00.000Z' },
  // Not delivered yet: the comparison must never pull these in.
  { orderRef: `${PREFIX}PLACED`, waybill: 'BA900009', cod: 1000, fee: 200, status: 'PLACED', deliveredAt: null },
  { orderRef: `${PREFIX}DISPATCHED`, waybill: 'BA900010', cod: 1000, fee: 200, status: 'DISPATCHED', deliveredAt: null },
];

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
    'INVOICE NO': 'TRA-QA-0001',
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

function writeSheet(filename: string, rows: SheetRow[]): void {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: HEADER });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice Details');
  XLSX.writeFile(workbook, path.join(OUT_DIR, filename));
  console.log(`  wrote ${path.join(OUT_DIR, filename)} (${rows.length} row(s))`);
}

/** Every delivered order exactly as the courier would report it. */
function happyRows(): SheetRow[] {
  return DELIVERIES.filter((item) => item.status === 'DELIVERED' && item.deliveredAt).map(
    (item) =>
      row(
        item.deliveredAt!.slice(0, 10),
        item.waybill ?? ' ',
        item.orderRef,
        item.cod,
        item.fee,
      ),
  );
}

function mixedRows(): SheetRow[] {
  return [
    // Clean matches.
    row('2026-07-13', 'BA900001', `${PREFIX}MATCH`, 3900, 475),
    // Collected less than the system COD (short by 475).
    row('2026-07-14', 'BA900002', `${PREFIX}COD-SHORT`, 3425, 475),
    // Courier charged 75 more than the system shipping fee.
    row('2026-07-15', 'BA900003', `${PREFIX}FEE`, 2500, 475),
    // Courier still shows it as pending.
    row('2026-07-16', 'BA900004', `${PREFIX}STATUS`, 1500, 350, 'Pending'),
    // Order-ref fallback (system has no waybill for this delivery).
    row('2026-07-19', ' ', `${PREFIX}ORDER-FALLBACK`, 2200, 350),
    // Duplicate waybill.
    row('2026-07-20', 'BA900006', `${PREFIX}DUP`, 1800, 300),
    row('2026-07-20', 'BA900006', `${PREFIX}DUP`, 1800, 300),
    // In the sheet but never in our system.
    row('2026-07-21', 'BA900007', 'NOT-IN-SYSTEM', 4500, 500),
    // No waybill and no order reference: cannot be matched at all.
    row('2026-07-22', ' ', ' ', 900, 0),
    // Outside July, so it must be counted as "outside range".
    row('2026-06-30', 'BA900008', 'OUTSIDE', 3300, 400),
  ];
}

function writeFixtures(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nWriting statements to ${OUT_DIR}`);

  writeSheet('happy-path-july-2026.xlsx', happyRows());

  writeSheet('mixed-differences-july-2026.xlsx', mixedRows());

  // Entirely June: uploading it while the page still defaults to the current
  // month must move the comparison to the sheet's own period, not report "no
  // differences".
  writeSheet('outside-range-june-2026.xlsx', [
    row('2026-06-01', 'BA910001', 'JUNE-1', 2000, 300),
    row('2026-06-02', 'BA910002', 'JUNE-2', 2500, 300),
  ]);

  // 459-ish unknown rows is what the real Trans Express sheet looks like to a
  // system with no deliveries; a compact version is enough for QA.
  writeSheet(
    'unknown-waybills-july-2026.xlsx',
    Array.from({ length: 25 }, (_, index) =>
      row('2026-07-13', `BA99${String(index + 1).padStart(4, '0')}`, `UNKNOWN-${index + 1}`, 3900, 475),
    ),
  );

  // Header row only: no readable statement rows at all.
  writeSheet('empty-sheet.xlsx', []);

  // No waybill column: matching has to fall back to the order reference.
  const fallback = happyRows().map((statement) => {
    const copy = { ...statement };
    delete copy['WAYBILL ID'];
    return copy;
  });
  const worksheet = XLSX.utils.json_to_sheet(fallback);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice Details');
  XLSX.writeFile(workbook, path.join(OUT_DIR, 'order-ref-fallback-july-2026.xlsx'));
  console.log('  wrote order-ref-fallback-july-2026.xlsx');
}

async function cleanup(): Promise<number> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'dilani' },
    select: { id: true },
  });
  if (!tenant) throw new Error('Tenant slug "dilani" not found');

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
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'dilani' },
    select: { id: true },
  });
  if (!tenant) throw new Error('Tenant slug "dilani" not found');

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
        deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : null,
        dispatchedAt:
          item.status === 'DISPATCHED' && item.deliveredAt
            ? new Date(item.deliveredAt)
            : item.status === 'DISPATCHED'
              ? new Date('2026-07-10T10:00:00.000Z')
              : null,
        notes: 'QA fixture — safe to delete (scripts/qa-reconciliation-seed.ts --cleanup)',
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

  console.log(`Seeded ${DELIVERIES.length} ${PREFIX} deliveries for tenant ${tenant.id}.`);
  writeFixtures();
}

const isCleanup = process.argv.includes('--cleanup');

(isCleanup
  ? cleanup().then((count) => console.log(`Removed ${count} ${PREFIX} deliver${count === 1 ? 'y' : 'ies'}.`))
  : seed()
)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
