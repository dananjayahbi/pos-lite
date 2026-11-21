/* eslint-disable no-console -- one-shot repair CLI: prints exactly what it changed */
/**
 * Backfill missing packaging consumptions for already-dispatched parcels
 * (ARGUS #279).
 *
 * Some historical deliveries were dispatched without a PackagingConsumption
 * row (or with the auto-deduct flag changed later), so their packaging stock
 * never went down. This script compares each delivery's courier shipments with
 * its existing consumption rows and fills the gap through the same
 * `autoDeductPackaging` path the dispatch pipeline uses.
 *
 * Dry run by default; never invoked automatically.
 *
 *   node --env-file=.env --import tsx scripts/backfill-packaging-consumptions.ts
 *   node --env-file=.env --import tsx scripts/backfill-packaging-consumptions.ts --apply
 *   node --env-file=.env --import tsx scripts/backfill-packaging-consumptions.ts --tenant=<id> --apply
 */
import { prisma } from '@/lib/prisma';
import { planPackagingDeduction } from '@/lib/services/packaging.core';
import { autoDeductPackaging } from '@/lib/services/packagingDeduction.service';

const APPLY = process.argv.includes('--apply');
const TENANT_ID = process.argv
  .find((arg) => arg.startsWith('--tenant='))
  ?.slice('--tenant='.length);

interface Candidate {
  id: string;
  tenantId: string;
  orderRef: string;
  shipmentCount: number;
}

async function main() {
  const items = await prisma.packagingItem.findMany({
    where: {
      deletedAt: null,
      autoDeduct: true,
      ...(TENANT_ID ? { tenantId: TENANT_ID } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      quantityOnHand: true,
      consumptionPerParcel: true,
    },
    orderBy: { name: 'asc' },
  });

  if (items.length === 0) {
    console.log('No auto-deduct packaging items configured. Nothing to do.');
    return;
  }

  const itemsByTenant = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByTenant.get(item.tenantId) ?? [];
    list.push(item);
    itemsByTenant.set(item.tenantId, list);
  }

  const deliveries = await prisma.delivery.findMany({
    where: {
      deletedAt: null,
      shipments: { some: {} },
      ...(TENANT_ID ? { tenantId: TENANT_ID } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      orderRef: true,
      _count: { select: { shipments: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const candidates: Candidate[] = [];
  let plannedRows = 0;
  let plannedUnits = 0;
  let shortItems = 0;

  for (const delivery of deliveries) {
    const tenantItems = itemsByTenant.get(delivery.tenantId) ?? [];
    if (tenantItems.length === 0) continue;

    const lines: string[] = [];

    for (const item of tenantItems) {
      const existing = await prisma.packagingConsumption.count({
        where: { deliveryId: delivery.id, packagingItemId: item.id },
      });
      const plan = planPackagingDeduction({
        perParcel: item.consumptionPerParcel?.toString() ?? '1',
        quantityOnHand: item.quantityOnHand,
        existingConsumptions: existing,
        parcelCount: delivery._count.shipments,
      });
      if (plan.missingParcels === 0) continue;

      // Rows written are per parcel; a partially-stocked final parcel still
      // produces one row. The dry run reports the units, not the row split.
      const rows = Math.min(plan.missingParcels, Math.ceil(plan.unitsToDeduct / plan.unitsPerParcel));
      plannedRows += plan.unitsToDeduct > 0 ? rows : 0;
      plannedUnits += plan.unitsToDeduct;
      if (plan.insufficient) shortItems += 1;

      lines.push(
        `  ${item.name}: ${plan.unitsToDeduct} unit(s) across ${plan.missingParcels} parcel(s) ` +
          `(stock ${item.quantityOnHand}${plan.insufficient ? ', SHORT' : ''})`,
      );
    }

    if (lines.length === 0) continue;

    candidates.push({
      id: delivery.id,
      tenantId: delivery.tenantId,
      orderRef: delivery.orderRef,
      shipmentCount: delivery._count.shipments,
    });

    console.log(
      `\n${delivery.orderRef} (${delivery.id}) - ${delivery._count.shipments} shipment(s)`,
    );
    for (const line of lines) console.log(line);
  }

  console.log(
    `\n${APPLY ? 'Repair' : 'Dry run'}: ${candidates.length} delivery(ies) need packaging, ` +
      `${plannedRows} consumption row(s), ${plannedUnits} unit(s)${shortItems > 0 ? `, ${shortItems} short item(s)` : ''}.`,
  );

  if (!APPLY) {
    console.log('Dry run only - no rows or stock were changed. Re-run with --apply.');
    return;
  }

  let writtenRows = 0;
  let deductedUnits = 0;
  for (const candidate of candidates) {
    const results = await autoDeductPackaging(candidate.tenantId, candidate.id, {
      actorId: 'SYSTEM',
    });
    for (const result of results) {
      writtenRows += result.consumed.greaterThan(0) ? 1 : 0;
      deductedUnits += result.consumed.toNumber();
      console.log(
        `APPLIED ${candidate.orderRef}: ${result.name} -${result.consumed.toFixed(2)}` +
          `${result.insufficient ? ' (stock short)' : ''}`,
      );
    }
  }

  console.log(
    `\nDone: ${candidates.length} delivery(ies) processed, ${writtenRows} item deduction(s), ${deductedUnits} unit(s) removed.`,
  );
}

main()
  .catch((error) => {
    console.error('Packaging consumption backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
