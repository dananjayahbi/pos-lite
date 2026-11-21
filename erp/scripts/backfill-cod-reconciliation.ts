/* eslint-disable no-console -- one-shot repair CLI: prints exactly what it changed */
/**
 * Backfill missing COD reconciliation ledger entries for delivered parcels
 * (ARGUS #511).
 *
 * Some historical deliveries were marked DELIVERED before the reconciliation
 * hook existed (or through a path that skipped it), so the ledger shows fewer
 * receivables than the delivered-COD total. This script lists every delivered
 * unpaid COD delivery and plans the collectable receivable (goods + shipping,
 * ARGUS #288). It is dry-run by default and never touches deliveries that
 * already have a ledger entry.
 *
 *   node --env-file=.env --import tsx scripts/backfill-cod-reconciliation.ts
 *   node --env-file=.env --import tsx scripts/backfill-cod-reconciliation.ts --apply
 *   node --env-file=.env --import tsx scripts/backfill-cod-reconciliation.ts --tenant=<tenantId> --apply
 *
 * The apply mode upserts one entry per missing delivery and writes a
 * RECONCILIATION_COD_BACKFILLED audit row naming this run. Not invoked by the
 * app or seed paths.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { AUDIT_ACTIONS } from '../src/lib/services/audit.service';
import {
  summarizeCodBackfill,
  type CodBackfillRow,
} from '../src/lib/services/reconciliation-cod.core';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');
const TENANT_ID = process.argv
  .find((arg) => arg.startsWith('--tenant='))
  ?.slice('--tenant='.length);

const BACKFILL_REFERENCE = 'argus-511-cod-reconciliation-backfill';

async function main() {
  const deliveries = await prisma.delivery.findMany({
    where: {
      status: 'DELIVERED',
      paymentMethod: 'COD',
      paymentStatus: { not: 'PAID' },
      deletedAt: null,
      ...(TENANT_ID ? { tenantId: TENANT_ID } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      orderRef: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      codAmount: true,
      shippingFee: true,
      reconciliationEntry: { select: { id: true } },
      shipments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { waybillId: true },
      },
    },
    orderBy: [{ tenantId: 'asc' }, { deliveredAt: 'asc' }],
  });

  const rows: Array<CodBackfillRow & { waybillId: string | null }> = deliveries.map(
    (delivery) => ({
      id: delivery.id,
      tenantId: delivery.tenantId,
      orderRef: delivery.orderRef,
      status: delivery.status,
      paymentMethod: delivery.paymentMethod,
      paymentStatus: delivery.paymentStatus,
      codAmount: delivery.codAmount,
      shippingFee: delivery.shippingFee,
      hasEntry: delivery.reconciliationEntry !== null,
      waybillId: delivery.shipments[0]?.waybillId ?? null,
    }),
  );

  const summary = summarizeCodBackfill(rows);
  const plannedIds = new Set(
    summary.plans.filter((plan) => plan.action === 'create').map((plan) => plan.id),
  );
  const planned = rows.filter((row) => plannedIds.has(row.id));

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — delivered unpaid COD deliveries: ${rows.length}`);
  console.log(
    `  create ${summary.createCount} entr${summary.createCount === 1 ? 'y' : 'ies'} ` +
      `(${summary.totalExpected} expected COD) · ` +
      `already present ${summary.existingCount} · not eligible ${summary.skippedCount}`,
  );
  for (const row of planned) {
    const plan = summary.plans.find((candidate) => candidate.id === row.id);
    console.log(
      `  + ${row.tenantId} ${row.orderRef} (${row.id}) expected ${plan?.expectedCod} ` +
        `waybill ${row.waybillId ?? '-'}`,
    );
  }

  if (!APPLY || planned.length === 0) {
    if (!APPLY) console.log('Dry run only; pass --apply to create the missing entries.');
    return;
  }

  let created = 0;
  for (const row of planned) {
    const plan = summary.plans.find((candidate) => candidate.id === row.id);
    if (!plan?.expectedCod) continue;

    const entry = await prisma.reconciliationLedgerEntry.upsert({
      where: { deliveryId: row.id },
      create: {
        tenantId: row.tenantId,
        deliveryId: row.id,
        waybillId: row.waybillId,
        expectedCod: plan.expectedCod,
        status: 'PENDING_SETTLEMENT',
      },
      update: {},
    });
    created += 1;
    await prisma.auditLog.create({
      data: {
        tenantId: row.tenantId,
        actorId: null,
        actorRole: 'SYSTEM',
        entityType: 'ReconciliationLedgerEntry',
        entityId: entry.id,
        action: AUDIT_ACTIONS.RECONCILIATION_COD_BACKFILLED,
        after: {
          reference: BACKFILL_REFERENCE,
          deliveryId: row.id,
          orderRef: row.orderRef,
          expectedCod: entry.expectedCod.toString(),
          waybillId: row.waybillId,
        },
      },
    });
  }

  console.log(`Created ${created} reconciliation entr${created === 1 ? 'y' : 'ies'}.`);
}

main()
  .catch((error) => {
    console.error('COD reconciliation backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
