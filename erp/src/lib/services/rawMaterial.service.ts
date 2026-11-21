/**
 * Raw Material Service Layer — sole entry point for raw-material inventory
 * operations. Multi-tenant scoped, ownership-verified before mutation, and
 * writes an audit trail on mutating operations.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { lockForUpdate } from '@/lib/api/race-guard';
import type { RawMaterial } from '@/generated/prisma/client';
import {
  attachAuditActorNames,
  createAuditLog,
  AUDIT_ACTIONS,
} from '@/lib/services/audit.service';
import {
  isRawMaterialAdjustmentReason,
  mapRawMaterialAdjustmentAudit,
  type RawMaterialAdjustmentHistoryItem,
  type RawMaterialAdjustmentReason,
} from '@/lib/services/rawMaterialAdjustment.core';
import {
  applyQuantityDeltaDecimal,
  roundRawMaterialQuantity,
  getRawMaterialCategoryLabel,
  getRawMaterialStockStatus,
  matchesRawMaterialStockStatus,
  type RawMaterialStockStatus,
} from '@/lib/services/rawMaterial.core';
import {
  assertRawMaterialCategoryExists,
  getRawMaterialCategoryNameMap,
} from '@/lib/services/rawMaterialCategory.service';
import {
  assertRawMaterialUnitExists,
  getRawMaterialUnitMap,
  type RawMaterialUnitOption,
} from '@/lib/services/rawMaterialUnit.service';

import {
  assertRawMaterialDeletable,
  assertRawMaterialUnitChangeAllowed,
} from '@/lib/services/rawMaterialGuards.core';
import { computeRawMaterialStockValue } from '@/lib/services/rawMaterialValuation.core';

// ── Public list item shape (Decimal → number for the client) ────────────────

export interface RawMaterialItem {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  unit: string;
  unitName: string;
  unitShortLabel: string;
  quantity: number;
  lowStockThreshold: number;
  /** Cost of one base unit (ARGUS #243). */
  unitCost: number;
  /** quantity x unitCost, for raw-material valuation. */
  stockValue: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  stockStatus: RawMaterialStockStatus;
}

export function toRawMaterialItem(
  m: RawMaterial,
  categoryName?: string | undefined,
  unit?: RawMaterialUnitOption | undefined,
): RawMaterialItem {
  const quantity = m.quantity.toNumber();
  const lowStockThreshold = m.lowStockThreshold.toNumber();
  const unitCost = m.unitCost.toNumber();
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    categoryName: categoryName ?? getRawMaterialCategoryLabel(m.category),
    unit: m.unit,
    unitName: unit?.name ?? m.unit,
    unitShortLabel: unit?.shortLabel ?? m.unit,
    quantity,
    lowStockThreshold,
    unitCost,
    stockValue: computeRawMaterialStockValue(quantity, unitCost),
    description: m.description,
    isActive: m.isActive,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    stockStatus: getRawMaterialStockStatus(quantity, lowStockThreshold),
  };
}

// ── List ─────────────────────────────────────────────────────────────────────

export interface ListRawMaterialsFilters {
  search?: string | undefined;
  category?: string | undefined;
  stockStatus?: RawMaterialStockStatus | undefined;
  page?: number;
  limit?: number;
}

export async function listRawMaterials(
  tenantId: string,
  filters: ListRawMaterialsFilters = {},
) {
  const { search, category, stockStatus, page = 1, limit = 25 } = filters;

  const where: Prisma.RawMaterialWhereInput = {
    tenantId,
    deletedAt: null,
  };

  if (search) {
    where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
  }
  if (category) {
    where.category = category;
  }

  if (stockStatus) {
    // ARGUS #242: Prisma cannot compare two columns, so the shared stock-state
    // rule is evaluated over the tenant's live materials and the matching ids
    // are pushed into the query BEFORE pagination. This keeps `total`,
    // `totalPages` and the page rows describing the filtered set, instead of
    // paging first and filtering the page in memory.
    const candidates = await prisma.rawMaterial.findMany({
      where,
      select: { id: true, quantity: true, lowStockThreshold: true },
    });

    where.id = {
      in: candidates
        .filter((row) =>
          matchesRawMaterialStockStatus(
            row.quantity.toNumber(),
            row.lowStockThreshold.toNumber(),
            stockStatus,
          ),
        )
        .map((row) => row.id),
    };
  }

  const skip = (page - 1) * limit;

  const [rows, total, categoryNames, unitMap] = await Promise.all([
    prisma.rawMaterial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.rawMaterial.count({ where }),
    getRawMaterialCategoryNameMap(tenantId),
    getRawMaterialUnitMap(tenantId),
  ]);

  const items = rows.map((row) =>
    toRawMaterialItem(row, categoryNames.get(row.category), unitMap.get(row.unit)),
  );

  return { items, total };
}

// ── Get by id ────────────────────────────────────────────────────────────────

async function findOwnedMaterial(tx: TxClient, tenantId: string, id: string) {
  const material = await tx.rawMaterial.findUnique({ where: { id } });
  if (!material || material.deletedAt) {
    throw new Error('NOT_FOUND');
  }
  if (material.tenantId !== tenantId) {
    throw new Error('FORBIDDEN');
  }
  return material;
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreateRawMaterialInput {
  name: string;
  category: string;
  unit: string;
  quantity?: string | undefined;
  lowStockThreshold?: string | undefined;
  unitCost?: string | undefined;
  description?: string | undefined;
}

export async function createRawMaterial(
  tenantId: string,
  actorId: string,
  input: CreateRawMaterialInput,
) {
  await assertRawMaterialCategoryExists(tenantId, input.category);
  await assertRawMaterialUnitExists(tenantId, input.unit);

  const material = await prisma.rawMaterial.create({
    data: {
      tenantId,
      name: input.name.trim(),
      category: input.category,
      unit: input.unit,
      quantity: new Prisma.Decimal(input.quantity ?? '0'),
      lowStockThreshold: new Prisma.Decimal(input.lowStockThreshold ?? '0'),
      unitCost: new Prisma.Decimal(input.unitCost ?? '0'),
      description: input.description?.trim() || null,
    },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'RawMaterial',
    entityId: material.id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_CREATED,
    after: { name: material.name, category: material.category, unit: material.unit },
  }).catch(() => {});

  const [categoryNames, unitMap] = await Promise.all([
    getRawMaterialCategoryNameMap(tenantId),
    getRawMaterialUnitMap(tenantId),
  ]);
  return toRawMaterialItem(
    material,
    categoryNames.get(material.category),
    unitMap.get(material.unit),
  );
}

// ── Update ───────────────────────────────────────────────────────────────────

export interface UpdateRawMaterialInput {
  name?: string | undefined;
  category?: string | undefined;
  unit?: string | undefined;
  lowStockThreshold?: string | undefined;
  unitCost?: string | undefined;
  description?: string | undefined;
  isActive?: boolean | undefined;
}

export async function updateRawMaterial(
  tenantId: string,
  actorId: string,
  id: string,
  input: UpdateRawMaterialInput,
) {
  if (input.category !== undefined) {
    await assertRawMaterialCategoryExists(tenantId, input.category);
  }
  if (input.unit !== undefined) {
    await assertRawMaterialUnitExists(tenantId, input.unit);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findOwnedMaterial(tx, tenantId, id);

    // ARGUS #241: quantity is deliberately NOT updatable here — stock changes
    // go through `adjustRawMaterialStock` (delta + reason + audit). A unit
    // change would reinterpret the stored number, so it is blocked while stock
    // is on hand.
    if (input.unit !== undefined) {
      assertRawMaterialUnitChangeAllowed({
        currentUnit: existing.unit,
        nextUnit: input.unit,
        quantityOnHand: existing.quantity.toNumber(),
      });
    }

    const updated = await tx.rawMaterial.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.lowStockThreshold !== undefined
          ? { lowStockThreshold: new Prisma.Decimal(input.lowStockThreshold) }
          : {}),
        ...(input.unitCost !== undefined
          ? { unitCost: new Prisma.Decimal(input.unitCost) }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'RawMaterial',
      entityId: id,
      action: AUDIT_ACTIONS.RAW_MATERIAL_UPDATED,
      after: { ...input },
    }).catch(() => {});

    const [categoryRow, unitRow] = await Promise.all([
      tx.rawMaterialCategoryOption.findFirst({
        where: { tenantId, key: updated.category },
        select: { name: true },
      }),
      tx.rawMaterialUnit.findFirst({
        where: { tenantId, key: updated.unit },
        select: { key: true, name: true, shortLabel: true },
      }),
    ]);

    return toRawMaterialItem(
      updated,
      categoryRow?.name,
      unitRow
        ? { key: unitRow.key, name: unitRow.name, shortLabel: unitRow.shortLabel }
        : undefined,
    );
  });
}

// ── Adjust stock ─────────────────────────────────────────────────────────────

export async function adjustRawMaterialStock(
  tenantId: string,
  actorId: string,
  id: string,
  quantityDelta: string | number,
  reason: RawMaterialAdjustmentReason,
) {
  // ARGUS #246: the route validator makes this required, but enforce the fixed
  // vocabulary here too so no internal caller can write a free-text reason.
  if (!isRawMaterialAdjustmentReason(reason)) {
    throw new Error('INVALID_REASON');
  }
  // ARGUS #245: Decimal arithmetic at the shared four-decimal scale. The delta
  // is rounded first, so a sub-scale value is a no-op rather than a float leak.
  const delta = roundRawMaterialQuantity(quantityDelta);
  if (delta.isZero()) {
    throw new Error('DELTA_ZERO');
  }

  return prisma.$transaction(async (tx) => {
    // Lock the material BEFORE reading its quantity. Two concurrent
    // adjustments used to read the same snapshot and lose one update.
    await lockForUpdate(tx, 'raw_materials', '"id" = $1 AND "tenantId" = $2', [
      id,
      tenantId,
    ]);
    const material = await findOwnedMaterial(tx, tenantId, id);
    const currentQuantity = roundRawMaterialQuantity(material.quantity);
    const newQuantity = applyQuantityDeltaDecimal(currentQuantity, delta);

    const updated = await tx.rawMaterial.update({
      where: { id },
      data: { quantity: newQuantity },
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'RawMaterial',
      entityId: id,
      action: AUDIT_ACTIONS.RAW_MATERIAL_STOCK_ADJUSTED,
      before: { quantity: currentQuantity.toFixed(4) },
      after: {
        quantityDelta: delta.toFixed(4),
        quantityBefore: currentQuantity.toFixed(4),
        quantityAfter: newQuantity.toFixed(4),
        reason,
      },
    }).catch(() => {});

    return toRawMaterialItem(updated);
  });
}

// ── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteRawMaterial(
  tenantId: string,
  actorId: string,
  id: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOwnedMaterial(tx, tenantId, id);

    // ARGUS #241: a soft delete hides the row from the list/stats/valuation but
    // writes no stock movement, so units on hand would vanish from the books.
    // Active BOMs would also be left pointing at a hidden material.
    const activeBomCount = await tx.billOfMaterialsItem.count({
      where: {
        rawMaterialId: id,
        bom: { tenantId, isActive: true, deletedAt: null },
      },
    });
    assertRawMaterialDeletable({
      quantityOnHand: existing.quantity.toNumber(),
      activeBomCount,
    });

    const updated = await tx.rawMaterial.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'RawMaterial',
      entityId: id,
      action: AUDIT_ACTIONS.RAW_MATERIAL_DELETED,
      before: {
        quantityOnHand: existing.quantity.toString(),
        activeBomCount,
      },
    }).catch(() => {});

    return toRawMaterialItem(updated);
  });
}

// ── Dashboard stats ──────────────────────────────────────────────────────────

export async function getRawMaterialStats(tenantId: string) {
  const where: Prisma.RawMaterialWhereInput = { tenantId, deletedAt: null };

  const [total, rows] = await Promise.all([
    prisma.rawMaterial.count({ where }),
    prisma.rawMaterial.findMany({
      where,
      select: { quantity: true, lowStockThreshold: true },
    }),
  ]);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const row of rows) {
    const status = getRawMaterialStockStatus(
      row.quantity.toNumber(),
      row.lowStockThreshold.toNumber(),
    );
    if (status === 'LOW') lowStockCount += 1;
    if (status === 'OUT') outOfStockCount += 1;
  }

  return {
    totalMaterials: total,
    lowStockCount,
    outOfStockCount,
  };
}

// ── Adjustment history ───────────────────────────────────────────────────────

/**
 * ARGUS #246: raw materials have no dedicated movement table, so the per-material
 * history is the durable `RAW_MATERIAL_STOCK_ADJUSTED` audit trail. Newest first.
 */
export async function listRawMaterialAdjustments(
  tenantId: string,
  rawMaterialId: string,
  limit = 50,
): Promise<{ items: RawMaterialAdjustmentHistoryItem[] }> {
  const material = await prisma.rawMaterial.findFirst({
    where: { id: rawMaterialId, tenantId },
    select: { id: true },
  });
  if (!material) {
    throw new Error('NOT_FOUND');
  }

  const rows = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entityType: 'RawMaterial',
      entityId: rawMaterialId,
      action: AUDIT_ACTIONS.RAW_MATERIAL_STOCK_ADJUSTED,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
  });

  const withActors = await attachAuditActorNames(rows);
  return {
    items: withActors.map((row) =>
      mapRawMaterialAdjustmentAudit({
        id: row.id,
        createdAt: row.createdAt,
        actorName: row.actorName,
        after: row.after,
      }),
    ),
  };
}

// ── Transaction client type ──────────────────────────────────────────────────

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
