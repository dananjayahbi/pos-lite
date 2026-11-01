import 'server-only';

import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import type { TxClient } from '@/lib/services/inventory.service';
import type {
  CreatePackagingItemInput,
  UpdatePackagingItemInput,
} from '@/lib/validators/packaging.validators';
import { serializeMoneyOrNull } from '@/lib/api/serialize';
import { comparePackagingItems } from '@/lib/constants/packaging';
import {
  buildPackagingSkuBase,
  nextAvailablePackagingSku,
  packagingCategoryLabel,
  packagingConsumptionUnits,
} from '@/lib/services/packaging.core';
import {
  assertPackagingCategoryExists,
  getPackagingCategoryNameMap,
} from '@/lib/services/packagingCategory.service';
import type { PackagingItem } from '@/generated/prisma/client';

/**
 * Packaging inventory service: CRUD for packaging items plus automatic
 * per-parcel deduction on dispatch (recorded as PackagingConsumption).
 * Deduction warns rather than blocks when stock is insufficient.
 *
 * INF-04: routes receive DTOs, never raw Prisma rows — the Decimal column
 * `consumptionPerParcel` is serialized to a 2-dp string by contract.
 */

export interface PackagingItemDto extends Omit<PackagingItem, 'consumptionPerParcel'> {
  consumptionPerParcel: string | null;
  /** Resolved, tenant-facing category name (falls back to the built-in label). */
  categoryName: string;
}

function toPackagingItemDto(
  item: PackagingItem,
  categoryNames?: Map<string, string>,
): PackagingItemDto {
  const key = item.category;
  return {
    ...item,
    consumptionPerParcel: serializeMoneyOrNull(item.consumptionPerParcel),
    categoryName: packagingCategoryLabel(key, categoryNames),
  };
}

export async function getPackagingItems(tenantId: string): Promise<PackagingItemDto[]> {
  const [items, categoryNames] = await Promise.all([
    prisma.packagingItem.findMany({
      where: { tenantId, deletedAt: null },
      // BUG-58/M23-02: Postgres native enums order by declaration position, not
      // alphabetically, so a DB-level `orderBy: { category: 'asc' }` does not
      // produce the pinned order. The list is small and unpaginated — sort
      // in-process against the category/name text instead.
      orderBy: [{ name: 'asc' }],
    }),
    getPackagingCategoryNameMap(tenantId),
  ]);
  return items
    .slice()
    .sort(comparePackagingItems)
    .map((item) => toPackagingItemDto(item, categoryNames));
}

/**
 * Derive a stable SKU from the category + name, e.g. "Bubble Wrap 50m" in
 * POLYMAILER becomes `POLY-BUBBLE-WRAP-50M`. A numeric suffix is appended when
 * the base is already taken for the tenant.
 */
export async function generatePackagingSku(
  tenantId: string,
  category: string,
  name: string,
): Promise<string> {
  const base = buildPackagingSkuBase(category, name);

  const existing = await prisma.packagingItem.findMany({
    where: {
      tenantId,
      sku: { startsWith: base },
    },
    select: { sku: true },
  });
  return nextAvailablePackagingSku(
    base,
    existing.map((row) => row.sku).filter((sku): sku is string => Boolean(sku)),
  );
}

export async function createPackagingItem(
  tenantId: string,
  actorId: string,
  input: CreatePackagingItemInput,
) {
  await assertPackagingCategoryExists(tenantId, input.category);

  const name = input.name.trim();
  const sku = input.autoGenerateSku
    ? await generatePackagingSku(tenantId, input.category, name)
    : input.sku?.trim() || undefined;

  const item = await prisma.packagingItem.create({
    data: {
      tenantId,
      category: input.category,
      name,
      unit: input.unit,
      quantityOnHand: input.quantityOnHand,
      lowStockThreshold: input.lowStockThreshold,
      autoDeduct: input.autoDeduct,
      ...(sku ? { sku } : {}),
      ...(input.consumptionPerParcel !== undefined
        ? { consumptionPerParcel: input.consumptionPerParcel }
        : {}),
    },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'UNKNOWN',
    entityType: 'PackagingItem',
    entityId: item.id,
    action: AUDIT_ACTIONS.PACKAGING_ITEM_CREATED,
    after: {
      name: item.name,
      category: item.category,
      sku: item.sku,
      quantityOnHand: item.quantityOnHand,
    },
  }).catch(() => {});

  const categoryNames = await getPackagingCategoryNameMap(tenantId);
  return toPackagingItemDto(item, categoryNames);
}

export async function updatePackagingItem(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdatePackagingItemInput,
) {
  const existing = await prisma.packagingItem.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  if (input.category !== undefined) {
    await assertPackagingCategoryExists(tenantId, input.category);
  }

  const data: Record<string, unknown> = {};
  if (input.category !== undefined) data.category = input.category;
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.quantityOnHand !== undefined) data.quantityOnHand = input.quantityOnHand;
  if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold;
  if (input.autoDeduct !== undefined) data.autoDeduct = input.autoDeduct;
  if (input.sku !== undefined) data.sku = input.sku?.trim() || null;
  if (input.consumptionPerParcel !== undefined)
    data.consumptionPerParcel = input.consumptionPerParcel;

  const updated = await prisma.packagingItem.update({
    where: { id },
    data: data as never,
  });

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'PackagingItem',
    entityId: id,
    action: AUDIT_ACTIONS.PACKAGING_ITEM_UPDATED,
    before: {
      name: existing.name,
      category: existing.category,
      quantityOnHand: existing.quantityOnHand,
    },
    after: {
      name: updated.name,
      category: updated.category,
      quantityOnHand: updated.quantityOnHand,
    },
  }).catch(() => {});

  const categoryNames = await getPackagingCategoryNameMap(tenantId);
  return toPackagingItemDto(updated, categoryNames);
}

/**
 * Soft-delete an item. Consumption history keeps pointing at the row, so the
 * delete is never a hard delete. The item must not be referenced by an open
 * (non-terminal) delivery's consumption trail? Consumption rows only exist for
 * already-dispatched parcels, so deleting is safe.
 */
export async function deletePackagingItem(tenantId: string, id: string, userId: string) {
  const existing = await prisma.packagingItem.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  await prisma.packagingItem.update({
    where: { id },
    data: { deletedAt: new Date(), autoDeduct: false },
  });

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'PackagingItem',
    entityId: id,
    action: AUDIT_ACTIONS.PACKAGING_ITEM_DELETED,
    before: {
      name: existing.name,
      category: existing.category,
      quantityOnHand: existing.quantityOnHand,
    },
  }).catch(() => {});
}

/** Manual stock-in/out with an audit trail. Delta can be positive or negative. */
export async function adjustPackagingStock(
  tenantId: string,
  id: string,
  userId: string,
  delta: number,
  note?: string,
) {
  const existing = await prisma.packagingItem.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  const next = existing.quantityOnHand + delta;
  if (next < 0) throw new Error('INSUFFICIENT_PACKAGING_STOCK');

  const updated = await prisma.packagingItem.update({
    where: { id },
    data: { quantityOnHand: next },
  });

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'PackagingItem',
    entityId: id,
    action: AUDIT_ACTIONS.PACKAGING_STOCK_ADJUSTED,
    before: { quantityOnHand: existing.quantityOnHand },
    after: { quantityOnHand: updated.quantityOnHand, note },
  }).catch(() => {});

  const categoryNames = await getPackagingCategoryNameMap(tenantId);
  return toPackagingItemDto(updated, categoryNames);
}

export interface DeductionResult {
  itemId: string;
  name: string;
  consumed: Decimal;
  insufficient: boolean;
}

export { packagingConsumptionUnits };

/**
 * Deduct configured auto-deduct packaging items for a parcel (typically 1
 * polymailer + 1 label). Writes PackagingConsumption rows. Warns (does not throw)
 * when stock is insufficient, returning which items fell short.
 *
 * Pass `tx` to make the deduction atomic with the delivery status change; that
 * is how dispatch/redelivery call it so a crash can never leave a dispatched
 * parcel with an un-deducted stock balance.
 */
export async function autoDeductPackaging(
  tenantId: string,
  deliveryId: string,
  opts?: { tx?: TxClient },
): Promise<DeductionResult[]> {
  const client = opts?.tx ?? prisma;
  const items = await client.packagingItem.findMany({
    where: { tenantId, deletedAt: null, autoDeduct: true },
  });

  if (items.length === 0) return [];

  const results: DeductionResult[] = [];

  for (const item of items) {
    const perParcel = new Decimal(item.consumptionPerParcel?.toString() ?? '1');
    const stock = new Decimal(item.quantityOnHand);
    const insufficient = stock.lessThan(perParcel);

    const wanted = packagingConsumptionUnits(perParcel);
    const units = Math.min(wanted, Math.max(item.quantityOnHand, 0));
    if (units <= 0) {
      if (wanted > 0) {
        results.push({
          itemId: item.id,
          name: item.name,
          consumed: new Decimal(0),
          insufficient: true,
        });
      }
      continue;
    }

    await client.packagingItem.update({
      where: { id: item.id },
      data: { quantityOnHand: { decrement: units } },
    });

    const consumedQty = new Decimal(units);
    await client.packagingConsumption.create({
      data: {
        tenantId,
        deliveryId,
        packagingItemId: item.id,
        quantity: consumedQty,
      },
    });

    results.push({ itemId: item.id, name: item.name, consumed: consumedQty, insufficient });
  }

  return results;
}

/** Create a non-blocking low-stock notification if any auto-deduct item is short. */
export async function notifyLowStock(
  tenantId: string,
  deliveryId: string,
  results: DeductionResult[] = [],
): Promise<void> {
  try {
    // Threshold-based, not `quantityOnHand <= 0`: an item with a configured
    // threshold of 5 must warn as soon as it drops to 5.
    const tracked = await prisma.packagingItem.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, quantityOnHand: true, lowStockThreshold: true },
    });

    const low = new Set<string>();
    for (const item of tracked) {
      if (item.quantityOnHand <= item.lowStockThreshold) {
        low.add(item.name);
      }
    }
    for (const r of results) {
      if (r.insufficient) low.add(r.name);
    }
    if (low.size === 0) return;

    const recipients = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (recipients.length === 0) return;
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type: 'PACKAGING_LOW_STOCK' as const,
        title: 'Packaging low stock',
        body: `Low packaging stock: ${Array.from(low).join(', ')}`,
        relatedEntityType: 'Delivery',
        relatedEntityId: deliveryId,
      })),
    });
  } catch (error) {
    console.warn('Low-stock notification failed:', error);
  }
}
