import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import type { PrismaClient } from '@/generated/prisma/client';
import type { TxClient } from '@/lib/services/inventory.service';
import { planPackagingDeduction } from '@/lib/services/packaging.core';

/**
 * Packaging-consumption writes (ARGUS #279).
 *
 * Split out of `packaging.service.ts` (which is server-only) so the repair
 * script can import the exact same deduction path. The module is still
 * server-side by construction: callers pass the Prisma transaction client.
 */

export type PackagingStockClient = Pick<
  PrismaClient,
  'packagingItem' | 'packagingConsumption' | 'courierShipment' | 'auditLog'
>;

export interface PackagingStockChange {
  before: number;
  after: number;
}

/**
 * Apply a signed stock delta through the packaging item itself (never a direct
 * update from a caller), refusing to drive the balance negative.
 */
export async function changePackagingStock(
  client: PackagingStockClient,
  tenantId: string,
  id: string,
  delta: number,
): Promise<PackagingStockChange> {
  const existing = await client.packagingItem.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { quantityOnHand: true },
  });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  const after = existing.quantityOnHand + delta;
  if (after < 0) throw new Error('INSUFFICIENT_PACKAGING_STOCK');

  const updated = await client.packagingItem.update({
    where: { id },
    data: { quantityOnHand: after },
    select: { quantityOnHand: true },
  });

  return { before: existing.quantityOnHand, after: updated.quantityOnHand };
}

export interface DeductionResult {
  itemId: string;
  name: string;
  consumed: Decimal;
  insufficient: boolean;
}

/**
 * Deduct configured auto-deduct packaging for every parcel (courier shipment)
 * that does not have a consumption row yet.
 *
 * One `PackagingConsumption` row and one audited stock decrement per parcel +
 * item. Idempotent: a retry/replay sees `missingParcels = 0`; a redelivery (new
 * shipment) fills exactly the new parcel. Writes through `changePackagingStock`
 * and the caller's transaction client, so dispatch and deduction commit
 * together.
 */
export async function autoDeductPackaging(
  tenantId: string,
  deliveryId: string,
  opts?: { tx?: TxClient; actorId?: string },
): Promise<DeductionResult[]> {
  const client = (opts?.tx ?? prisma) as PackagingStockClient;

  const items = await client.packagingItem.findMany({
    where: { tenantId, deletedAt: null, autoDeduct: true },
  });
  if (items.length === 0) return [];

  // One parcel = one CourierShipment. Counting all shipment rows (including a
  // superseded redelivery attempt) makes a retry for the same parcel a no-op
  // while a genuinely new shipment still deducts.
  const parcelCount = await client.courierShipment.count({
    where: { deliveryId, tenantId },
  });
  if (parcelCount === 0) return [];

  const results: DeductionResult[] = [];

  for (const item of items) {
    const existingConsumptions = await client.packagingConsumption.count({
      where: { deliveryId, packagingItemId: item.id },
    });

    const plan = planPackagingDeduction({
      perParcel: item.consumptionPerParcel?.toString() ?? '1',
      quantityOnHand: item.quantityOnHand,
      existingConsumptions,
      parcelCount,
    });

    if (plan.missingParcels === 0) continue;

    let remaining = plan.unitsToDeduct;
    let consumed = new Decimal(0);

    // One row per parcel; the final parcel may be partial when stock runs out.
    for (let parcel = 0; parcel < plan.missingParcels && remaining > 0; parcel++) {
      const take = Math.min(plan.unitsPerParcel, remaining);
      if (take <= 0) break;

      const change = await changePackagingStock(client, tenantId, item.id, -take).catch(
        (error: unknown) => {
          // Concurrent consumption can empty the shelf between the plan and
          // the write. Insufficient packaging never blocks a dispatch, so stop
          // at what was available instead of failing the status transition.
          if (error instanceof Error && error.message === 'INSUFFICIENT_PACKAGING_STOCK') {
            return null;
          }
          throw error;
        },
      );
      if (!change) break;

      await client.packagingConsumption.create({
        data: {
          tenantId,
          deliveryId,
          packagingItemId: item.id,
          quantity: take,
        },
      });

      await client.auditLog.create({
        data: {
          tenantId,
          actorId: opts?.actorId ?? null,
          actorRole: 'SYSTEM',
          entityType: 'PackagingItem',
          entityId: item.id,
          action: AUDIT_ACTIONS.PACKAGING_STOCK_ADJUSTED,
          before: { quantityOnHand: change.before },
          after: {
            quantityOnHand: change.after,
            note: `Auto-deduct ${take} for delivery ${deliveryId}`,
            deliveryId,
            autoDeduct: true,
          },
        },
      });

      remaining -= take;
      consumed = consumed.plus(take);
    }

    const wanted = new Decimal(plan.unitsPerParcel).mul(plan.missingParcels);
    results.push({
      itemId: item.id,
      name: item.name,
      consumed,
      insufficient: consumed.lessThan(wanted),
    });
  }

  return results;
}
