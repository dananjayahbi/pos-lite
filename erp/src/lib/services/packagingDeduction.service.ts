import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import type { PrismaClient } from '@/generated/prisma/client';
import type { TxClient } from '@/lib/services/inventory.service';
import {
  decidePackagingShortfall,
  planPackagingDeduction,
  type PackagingShortfallItem,
} from '@/lib/services/packaging.core';

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

/**
 * Resolve which items a dispatch consumes.
 *
 * ARGUS #283: `itemIds` is the explicit per-delivery selection (an empty array
 * means "use no packaging"). When omitted, auto-deduct items remain the default
 * suggestion for older callers. Every explicitly selected id must exist for the
 * tenant, so a stale browser cannot silently consume an unrelated/foreign item.
 */
async function resolveDeductionItems(
  client: PackagingStockClient,
  tenantId: string,
  itemIds?: string[],
) {
  if (itemIds !== undefined) {
    const ids = [...new Set(itemIds)];
    if (ids.length === 0) return [];
    const items = await client.packagingItem.findMany({
      where: { tenantId, deletedAt: null, id: { in: ids } },
    });
    if (items.length !== ids.length) throw new Error('PACKAGING_ITEM_NOT_FOUND');
    return items;
  }

  return client.packagingItem.findMany({
    where: { tenantId, deletedAt: null, autoDeduct: true },
  });
}

export interface DeductionResult {
  itemId: string;
  name: string;
  consumed: Decimal;
  /** Whole units the dispatch called for (before the stock cap). */
  required: number;
  /** Stock on hand before this deduction. */
  available: number;
  insufficient: boolean;
}

export interface PackagingDeductionPreviewItem {
  itemId: string;
  name: string;
  unit: string;
  unitsPerParcel: number;
  missingParcels: number;
  requiredUnits: number;
  availableUnits: number;
  insufficient: boolean;
}

export interface PackagingDeductionPreview {
  parcelCount: number;
  items: PackagingDeductionPreviewItem[];
  insufficient: boolean;
}

/**
 * ARGUS #282: preflight the same plan the transaction will apply, with NO
 * writes. `pendingParcels` lets dispatch include the parcel it is about to
 * create (the shipment row does not exist yet when this runs).
 */
export async function previewPackagingDeduction(
  tenantId: string,
  deliveryId: string,
  opts: { tx?: TxClient; itemIds?: string[]; pendingParcels?: number } = {},
): Promise<PackagingDeductionPreview> {
  const client = (opts.tx ?? prisma) as PackagingStockClient;
  const items = await resolveDeductionItems(client, tenantId, opts.itemIds);
  if (items.length === 0) {
    const parcelCount = await client.courierShipment.count({ where: { deliveryId, tenantId } });
    return { parcelCount, items: [], insufficient: false };
  }

  const recordedParcels = await client.courierShipment.count({
    where: { deliveryId, tenantId },
  });
  const parcelCount = recordedParcels + Math.max(Math.floor(opts.pendingParcels ?? 0), 0);

  const previewItems: PackagingDeductionPreviewItem[] = [];
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

    previewItems.push({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      unitsPerParcel: plan.unitsPerParcel,
      missingParcels: plan.missingParcels,
      requiredUnits: plan.unitsPerParcel * plan.missingParcels,
      availableUnits: item.quantityOnHand,
      insufficient: plan.insufficient,
    });
  }

  return {
    parcelCount,
    items: previewItems,
    insufficient: previewItems.some((item) => item.insufficient),
  };
}

/** Typed 409 used by both the preflight and the in-transaction enforcement. */
export function packagingShortfallError(
  shortItems: PackagingShortfallItem[],
  deliveryId: string,
): ApiError {
  const summary = shortItems
    .map((item) => `${item.name} (need ${item.requiredUnits}, have ${item.availableUnits})`)
    .join('; ');
  return new ApiError(
    409,
    'PACKAGING_SHORTFALL',
    `Not enough packaging stock to dispatch: ${summary}. Reassign the packaging items or confirm the shortfall override.`,
    { deliveryId, items: shortItems },
  );
}

/**
 * Throw when the configured packaging is short, unless the caller explicitly
 * overrides. Runs before the courier upload so a doomed dispatch never issues a
 * waybill.
 */
export async function assertPackagingAvailableForDispatch(
  tenantId: string,
  deliveryId: string,
  opts: { itemIds?: string[]; allowShortfall?: boolean } = {},
): Promise<PackagingDeductionPreview> {
  const preview = await previewPackagingDeduction(tenantId, deliveryId, {
    ...(opts.itemIds !== undefined ? { itemIds: opts.itemIds } : {}),
    pendingParcels: 1,
  });
  const decision = decidePackagingShortfall(
    preview.items.map((item) => ({
      name: item.name,
      requiredUnits: item.requiredUnits,
      availableUnits: item.availableUnits,
      insufficient: item.insufficient,
    })),
    { allowOverride: opts.allowShortfall === true },
  );
  if (decision.blocked) throw packagingShortfallError(decision.shortItems, deliveryId);
  return preview;
}

/**
 * Deduct configured packaging for every parcel (courier shipment) that does not
 * have a consumption row yet.
 *
 * One `PackagingConsumption` row and one audited stock decrement per parcel +
 * item. Idempotent: a retry/replay sees `missingParcels = 0`; a redelivery (new
 * shipment) fills exactly the new parcel. Writes through `changePackagingStock`
 * and the caller's transaction client, so dispatch and deduction commit
 * together.
 *
 * ARGUS #282: a shortfall throws a typed `PACKAGING_SHORTFALL` (rolling the
 * transaction back) unless `allowShortfall` is explicitly set.
 */
export async function autoDeductPackaging(
  tenantId: string,
  deliveryId: string,
  opts?: {
    tx?: TxClient;
    actorId?: string;
    itemIds?: string[];
    allowShortfall?: boolean;
  },
): Promise<DeductionResult[]> {
  const client = (opts?.tx ?? prisma) as PackagingStockClient;

  const items = await resolveDeductionItems(client, tenantId, opts?.itemIds);
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
          // the write. Stop at what was available; the shortfall decision below
          // decides whether that is acceptable for this caller.
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
      required: wanted.toNumber(),
      available: item.quantityOnHand,
      insufficient: consumed.lessThan(wanted),
    });
  }

  const decision = decidePackagingShortfall(
    results.map((result) => ({
      name: result.name,
      requiredUnits: result.required,
      availableUnits: result.available,
      insufficient: result.insufficient,
    })),
    { allowOverride: opts?.allowShortfall === true },
  );
  if (decision.blocked) throw packagingShortfallError(decision.shortItems, deliveryId);

  return results;
}
