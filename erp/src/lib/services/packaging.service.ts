import 'server-only';

import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import type { TxClient } from '@/lib/services/inventory.service';
import type { CreatePackagingItemInput, UpdatePackagingItemInput } from '@/lib/validators/packaging.validators';

/**
 * Packaging inventory service: CRUD for packaging items plus automatic
 * per-parcel deduction on dispatch (recorded as PackagingConsumption).
 * Deduction warns rather than blocks when stock is insufficient.
 */

export async function getPackagingItems(tenantId: string) {
  return prisma.packagingItem.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function createPackagingItem(tenantId: string, input: CreatePackagingItemInput) {
  const item = await prisma.packagingItem.create({
    data: {
      tenantId,
      category: input.category,
      name: input.name,
      unit: input.unit,
      quantityOnHand: input.quantityOnHand,
      lowStockThreshold: input.lowStockThreshold,
      autoDeduct: input.autoDeduct,
      ...(input.sku ? { sku: input.sku } : {}),
      ...(input.consumptionPerParcel !== undefined ? { consumptionPerParcel: input.consumptionPerParcel } : {}),
    },
  });
  return item;
}

export async function updatePackagingItem(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdatePackagingItemInput,
) {
  const existing = await prisma.packagingItem.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  const data: Record<string, unknown> = {};
  if (input.category !== undefined) data.category = input.category;
  if (input.name !== undefined) data.name = input.name;
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.quantityOnHand !== undefined) data.quantityOnHand = input.quantityOnHand;
  if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold;
  if (input.autoDeduct !== undefined) data.autoDeduct = input.autoDeduct;
  if (input.sku !== undefined) data.sku = input.sku;
  if (input.consumptionPerParcel !== undefined) data.consumptionPerParcel = input.consumptionPerParcel;

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
    action: AUDIT_ACTIONS.PACKAGING_STOCK_ADJUSTED,
    after: { name: updated.name, quantityOnHand: updated.quantityOnHand },
  });
  return updated;
}

/** Manual stock-in/out with an audit trail. Delta can be positive or negative. */
export async function adjustPackagingStock(
  tenantId: string,
  id: string,
  userId: string,
  delta: number,
  note?: string,
) {
  const existing = await prisma.packagingItem.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  const updated = await prisma.packagingItem.update({
    where: { id },
    data: { quantityOnHand: { increment: delta } },
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
  });
  return updated;
}

export interface DeductionResult {
  itemId: string;
  name: string;
  consumed: Decimal;
  insufficient: boolean;
}

/**
 * Deduct configured auto-deduct packaging items for a parcel (typically 1
 * polymailer + 1 label). Writes PackagingConsumption rows. Warns (does not throw)
 * when stock is insufficient, returning which items fell short.
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

    const consumedQty = insufficient ? stock : perParcel;
    if (consumedQty.lessThanOrEqualTo(0)) continue;

    await client.packagingItem.update({
      where: { id: item.id },
      data: { quantityOnHand: { decrement: consumedQty.toDecimalPlaces(0).toNumber() } },
    });

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
  results: DeductionResult[],
): Promise<void> {
  try {
    const below = await prisma.packagingItem.findMany({
      where: {
        tenantId,
        deletedAt: null,
        quantityOnHand: { lte: 0 },
      },
      select: { id: true, name: true, quantityOnHand: true, lowStockThreshold: true },
    });

    const low: string[] = [];
    for (const item of below) {
      if (item.quantityOnHand <= item.lowStockThreshold) {
        low.push(item.name);
      }
    }
    for (const r of results) {
      if (r.insufficient) low.push(r.name);
    }
    if (low.length === 0) return;

    const recipients = await prisma.user.findMany({
      where: { tenantId, role: { in: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'] }, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (recipients.length === 0) return;
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type: 'PACKAGING_LOW_STOCK' as const,
        title: 'Packaging low stock',
        body: `Low packaging stock: ${Array.from(new Set(low)).join(', ')}`,
        relatedEntityType: 'Delivery',
        relatedEntityId: deliveryId,
      })),
    });
  } catch (error) {
    console.warn('Low-stock notification failed:', error);
  }
}
