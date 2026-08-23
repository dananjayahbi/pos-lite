/**
 * Raw Material Service Layer — sole entry point for raw-material inventory
 * operations. Multi-tenant scoped, ownership-verified before mutation, and
 * writes an audit trail on mutating operations.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type {
  RawMaterial,
  RawMaterialCategory,
  Unit,
} from '@/generated/prisma/client';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  applyQuantityDelta,
  getRawMaterialStockStatus,
  type RawMaterialStockStatus,
} from '@/lib/services/rawMaterial.core';

// ── Public list item shape (Decimal → number for the client) ────────────────

export interface RawMaterialItem {
  id: string;
  name: string;
  category: RawMaterialCategory;
  unit: Unit;
  quantity: number;
  lowStockThreshold: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  stockStatus: RawMaterialStockStatus;
}

function toRawMaterialItem(m: RawMaterial): RawMaterialItem {
  const quantity = m.quantity.toNumber();
  const lowStockThreshold = m.lowStockThreshold.toNumber();
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    unit: m.unit,
    quantity,
    lowStockThreshold,
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
  category?: RawMaterialCategory | undefined;
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

  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.rawMaterial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.rawMaterial.count({ where }),
  ]);

  let items = rows.map(toRawMaterialItem);

  if (stockStatus) {
    items = items.filter((item) => item.stockStatus === stockStatus);
  }

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
  category: RawMaterialCategory;
  unit: Unit;
  quantity?: string | undefined;
  lowStockThreshold?: string | undefined;
  description?: string | undefined;
}

export async function createRawMaterial(
  tenantId: string,
  actorId: string,
  input: CreateRawMaterialInput,
) {
  const material = await prisma.rawMaterial.create({
    data: {
      tenantId,
      name: input.name.trim(),
      category: input.category,
      unit: input.unit,
      quantity: new Prisma.Decimal(input.quantity ?? '0'),
      lowStockThreshold: new Prisma.Decimal(input.lowStockThreshold ?? '0'),
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

  return toRawMaterialItem(material);
}

// ── Update ───────────────────────────────────────────────────────────────────

export interface UpdateRawMaterialInput {
  name?: string | undefined;
  category?: RawMaterialCategory | undefined;
  unit?: Unit | undefined;
  quantity?: string | undefined;
  lowStockThreshold?: string | undefined;
  description?: string | undefined;
  isActive?: boolean | undefined;
}

export async function updateRawMaterial(
  tenantId: string,
  actorId: string,
  id: string,
  input: UpdateRawMaterialInput,
) {
  return prisma.$transaction(async (tx) => {
    await findOwnedMaterial(tx, tenantId, id);

    const updated = await tx.rawMaterial.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.quantity !== undefined
          ? { quantity: new Prisma.Decimal(input.quantity) }
          : {}),
        ...(input.lowStockThreshold !== undefined
          ? { lowStockThreshold: new Prisma.Decimal(input.lowStockThreshold) }
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

    return toRawMaterialItem(updated);
  });
}

// ── Adjust stock ─────────────────────────────────────────────────────────────

export async function adjustRawMaterialStock(
  tenantId: string,
  actorId: string,
  id: string,
  quantityDelta: number,
) {
  if (quantityDelta === 0) {
    throw new Error('DELTA_ZERO');
  }

  return prisma.$transaction(async (tx) => {
    const material = await findOwnedMaterial(tx, tenantId, id);
    const currentQuantity = material.quantity.toNumber();
    const newQuantity = applyQuantityDelta(currentQuantity, quantityDelta);

    const updated = await tx.rawMaterial.update({
      where: { id },
      data: { quantity: new Prisma.Decimal(newQuantity) },
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'RawMaterial',
      entityId: id,
      action: AUDIT_ACTIONS.RAW_MATERIAL_STOCK_ADJUSTED,
      after: { quantityDelta, quantityBefore: currentQuantity, quantityAfter: newQuantity },
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
    await findOwnedMaterial(tx, tenantId, id);

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

// ── Transaction client type ──────────────────────────────────────────────────

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
