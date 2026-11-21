import 'server-only';

import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
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
import { assertPackagingItemDeletable } from '@/lib/services/packagingGuards.core';
import {
  toPackagingHistoryRow,
  type PackagingHistoryRow,
} from '@/lib/packaging/packagingHistory.core';
import {
  changePackagingStock,
  type DeductionResult,
} from '@/lib/services/packagingDeduction.service';
export {
  autoDeductPackaging,
  assertPackagingAvailableForDispatch,
  previewPackagingDeduction,
  type DeductionResult,
  type PackagingDeductionPreview,
} from '@/lib/services/packagingDeduction.service';
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
 * Newest-first packaging consumption ledger (ARGUS #281). Paginated and
 * optionally scoped to one item. Reads the same `PackagingConsumption` rows
 * that reconciliation relies on, including consumptions of soft-deleted items
 * (the delete dialog promises that history is kept).
 */
export async function getPackagingConsumptionHistory(
  tenantId: string,
  input: {
    page?: number | undefined;
    pageSize?: number | undefined;
    itemId?: string | undefined;
  } = {},
): Promise<{
  rows: PackagingHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize ?? 25)), 100);
  const where = {
    tenantId,
    ...(input.itemId ? { packagingItemId: input.itemId } : {}),
  };

  const [consumptions, total] = await Promise.all([
    prisma.packagingConsumption.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        packagingItem: { select: { id: true, name: true, sku: true, unit: true } },
        delivery: { select: { id: true, orderRef: true, saleId: true } },
      },
    }),
    prisma.packagingConsumption.count({ where }),
  ]);

  const rows = consumptions.map((consumption) =>
    toPackagingHistoryRow({
      id: consumption.id,
      deliveryId: consumption.deliveryId,
      orderRef: consumption.delivery.orderRef,
      saleId: consumption.delivery.saleId,
      packagingItemId: consumption.packagingItemId,
      itemName: consumption.packagingItem.name,
      itemSku: consumption.packagingItem.sku,
      unit: consumption.packagingItem.unit,
      quantity: consumption.quantity.toString(),
      createdAt: consumption.createdAt,
    }),
  );

  return { rows, total, page, pageSize };
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
    // Stock is not editable here (ARGUS #280); quantity only changes through
    // `adjustPackagingStock`, which carries its own reason/note audit.
    before: {
      name: existing.name,
      category: existing.category,
      unit: existing.unit,
      lowStockThreshold: existing.lowStockThreshold,
      autoDeduct: existing.autoDeduct,
    },
    after: {
      name: updated.name,
      category: updated.category,
      unit: updated.unit,
      lowStockThreshold: updated.lowStockThreshold,
      autoDeduct: updated.autoDeduct,
    },
  }).catch(() => {});

  const categoryNames = await getPackagingCategoryNameMap(tenantId);
  return toPackagingItemDto(updated, categoryNames);
}

/**
 * Soft-delete an item. Consumption history keeps pointing at the row, so the
 * delete is never a hard delete. Stock must be zero first — a soft delete hides
 * the row from stock queries without writing anything off (ARGUS #280). The
 * row keeps its `autoDeduct`/consumption history; only the item is hidden.
 */
export async function deletePackagingItem(tenantId: string, id: string, userId: string) {
  const existing = await prisma.packagingItem.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new Error('PACKAGING_ITEM_NOT_FOUND');

  assertPackagingItemDeletable({
    quantityOnHand: existing.quantityOnHand,
    unit: existing.unit,
  });

  await prisma.packagingItem.update({
    where: { id },
    data: { deletedAt: new Date() },
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
  const change = await changePackagingStock(prisma, tenantId, id, delta);
  const updated = await prisma.packagingItem.findUniqueOrThrow({ where: { id } });
  const reason = note?.trim() || 'Manual stock adjustment';

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'PackagingItem',
    entityId: id,
    action: AUDIT_ACTIONS.PACKAGING_STOCK_ADJUSTED,
    before: { quantityOnHand: change.before },
    after: { quantityOnHand: change.after, note: reason, reason },
  }).catch(() => {});

  const categoryNames = await getPackagingCategoryNameMap(tenantId);
  return toPackagingItemDto(updated, categoryNames);
}

export { packagingConsumptionUnits };

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
