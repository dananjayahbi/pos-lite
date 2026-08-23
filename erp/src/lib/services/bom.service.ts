/**
 * Bill of Materials Service Layer — BOM CRUD plus production logging with
 * automatic raw-material deduction. Multi-tenant scoped, ownership-verified,
 * and every mutation runs in a single transaction to preserve inventory
 * integrity (doc 26).
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type {
  BillOfMaterials,
  BillOfMaterialsItem,
  ProductVariant,
  RawMaterial,
} from '@/generated/prisma/client';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  computeConsumptionPlan,
  getInsufficientIngredients,
  hasInsufficientIngredients,
  isSourceEligibleForProduction,
  toBomIngredient,
  type ConsumptionLine,
} from '@/lib/services/bom.core';
import { adjustStockInTx } from '@/lib/services/inventory.service';

// ── Public list item shape ──────────────────────────────────────────────────

export interface BomItemView {
  id: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  name: string;
  isActive: boolean;
  notes: string | null;
  rawMaterialCount: number;
  ingredients: { rawMaterialId: string; name: string; quantityPerUnit: number }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BomIngredientView {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: RawMaterial['unit'];
  quantityPerUnit: number;
  available: number;
}

export interface BomDetailView {
  id: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  name: string;
  isActive: boolean;
  notes: string | null;
  ingredients: BomIngredientView[];
  createdAt: Date;
  updatedAt: Date;
}

type BomWithItems = BillOfMaterials & {
  variant: Pick<ProductVariant, 'id' | 'sku'> & {
    product: { name: string; productSource: 'MANUFACTURED' | 'TRADED' };
  };
  items: (BillOfMaterialsItem & {
    rawMaterial: Pick<RawMaterial, 'id' | 'name' | 'unit' | 'quantity'>;
  })[];
};

function toBomItemView(bom: BomWithItems): BomItemView {
  return {
    id: bom.id,
    variantId: bom.variantId,
    variantSku: bom.variant.sku,
    variantName: bom.variant.product.name,
    name: bom.name,
    isActive: bom.isActive,
    notes: bom.notes,
    rawMaterialCount: bom.items.length,
    ingredients: bom.items.map((item) => ({
      rawMaterialId: item.rawMaterialId,
      name: item.rawMaterial.name,
      quantityPerUnit: item.quantityPerUnit.toNumber(),
    })),
    createdAt: bom.createdAt,
    updatedAt: bom.updatedAt,
  };
}

function toBomDetailView(bom: BomWithItems): BomDetailView {
  return {
    id: bom.id,
    variantId: bom.variantId,
    variantSku: bom.variant.sku,
    variantName: bom.variant.product.name,
    name: bom.name,
    isActive: bom.isActive,
    notes: bom.notes,
    ingredients: bom.items.map((item) => ({
      id: item.id,
      rawMaterialId: item.rawMaterialId,
      rawMaterialName: item.rawMaterial.name,
      unit: item.rawMaterial.unit,
      quantityPerUnit: item.quantityPerUnit.toNumber(),
      available: item.rawMaterial.quantity.toNumber(),
    })),
    createdAt: bom.createdAt,
    updatedAt: bom.updatedAt,
  };
}

const bomInclude = {
  variant: {
    select: {
      id: true,
      sku: true,
      product: { select: { name: true, productSource: true } },
    },
  },
  items: {
    include: {
      rawMaterial: {
        select: { id: true, name: true, unit: true, quantity: true },
      },
    },
  },
} as const;

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function findOwnedBom(tx: TxClient, tenantId: string, id: string) {
  const bom = await tx.billOfMaterials.findUnique({
    where: { id },
    include: bomInclude,
  });
  if (!bom || bom.deletedAt) throw new Error('NOT_FOUND');
  if (bom.tenantId !== tenantId) throw new Error('FORBIDDEN');
  return bom;
}

// ── List ─────────────────────────────────────────────────────────────────────

export interface ListBomsFilters {
  variantId?: string | undefined;
  search?: string | undefined;
  page?: number;
  limit?: number;
}

export async function listBoms(tenantId: string, filters: ListBomsFilters = {}) {
  const { variantId, search, page = 1, limit = 25 } = filters;

  const where: Prisma.BillOfMaterialsWhereInput = {
    tenantId,
    deletedAt: null,
  };
  if (variantId) where.variantId = variantId;
  if (search) {
    where.variant = {
      product: { name: { contains: search, mode: 'insensitive' } },
    };
  }

  const [rows, total] = await Promise.all([
    prisma.billOfMaterials.findMany({
      where,
      include: bomInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.billOfMaterials.count({ where }),
  ]);

  return { items: rows.map(toBomItemView), total };
}

// ── Get by id ────────────────────────────────────────────────────────────────

export async function getBomById(tenantId: string, id: string) {
  const bom = await findOwnedBom(prisma, tenantId, id);
  return toBomDetailView(bom);
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface BomIngredientInput {
  rawMaterialId: string;
  quantityPerUnit: string;
}

export interface CreateBomInput {
  variantId: string;
  name: string;
  notes?: string | undefined;
  ingredients: BomIngredientInput[];
}

export async function createBom(
  tenantId: string,
  actorId: string,
  input: CreateBomInput,
) {
  if (input.ingredients.length === 0) {
    throw new Error('NO_INGREDIENTS');
  }

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: {
        id: true,
        tenantId: true,
        deletedAt: true,
        product: { select: { productSource: true } },
      },
    });
    if (!variant || variant.deletedAt) throw new Error('VARIANT_NOT_FOUND');
    if (variant.tenantId !== tenantId) throw new Error('FORBIDDEN');
    // Traded goods are resold as-is and must NOT be routed through BOM/production.
    if (!isSourceEligibleForProduction(variant.product.productSource)) {
      throw new Error('TRADED_NOT_MANUFACTURED');
    }

    const existing = await tx.billOfMaterials.findUnique({
      where: { tenantId_variantId: { tenantId, variantId: input.variantId } },
    });
    if (existing && !existing.deletedAt) throw new Error('BOM_EXISTS');

    const rawMaterialIds = [...new Set(input.ingredients.map((i) => i.rawMaterialId))];
    const ownedMaterials = await tx.rawMaterial.findMany({
      where: { tenantId, id: { in: rawMaterialIds }, deletedAt: null },
      select: { id: true },
    });
    const ownedIdSet = new Set(ownedMaterials.map((m) => m.id));
    for (const id of rawMaterialIds) {
      if (!ownedIdSet.has(id)) throw new Error('INGREDIENT_NOT_FOUND');
    }

    const bom = await tx.billOfMaterials.create({
      data: {
        tenantId,
        variantId: input.variantId,
        name: input.name.trim(),
        notes: input.notes?.trim() || null,
        items: {
          create: input.ingredients.map((ing) => ({
            rawMaterialId: ing.rawMaterialId,
            quantityPerUnit: new Prisma.Decimal(ing.quantityPerUnit),
          })),
        },
      },
      include: bomInclude,
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'BillOfMaterials',
      entityId: bom.id,
      action: AUDIT_ACTIONS.BOM_CREATED,
      after: {
        variantId: input.variantId,
        name: bom.name,
        ingredientCount: input.ingredients.length,
      },
    }).catch(() => {});

    return toBomDetailView(bom);
  });
}

// ── Update (replace ingredients) ─────────────────────────────────────────────

export interface UpdateBomInput {
  name?: string | undefined;
  notes?: string | undefined;
  isActive?: boolean | undefined;
  ingredients?: BomIngredientInput[] | undefined;
}

export async function updateBom(
  tenantId: string,
  actorId: string,
  id: string,
  input: UpdateBomInput,
) {
  return prisma.$transaction(async (tx) => {
    await findOwnedBom(tx, tenantId, id);

    const bom = await tx.billOfMaterials.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.ingredients !== undefined
          ? {
              items: {
                deleteMany: {},
                create: input.ingredients.map((ing) => ({
                  rawMaterialId: ing.rawMaterialId,
                  quantityPerUnit: new Prisma.Decimal(ing.quantityPerUnit),
                })),
              },
            }
          : {}),
      },
      include: bomInclude,
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'BillOfMaterials',
      entityId: id,
      action: AUDIT_ACTIONS.BOM_UPDATED,
      after: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.ingredients !== undefined
          ? { ingredientCount: input.ingredients.length }
          : {}),
      },
    }).catch(() => {});

    return toBomDetailView(bom);
  });
}

// ── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteBom(tenantId: string, actorId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await findOwnedBom(tx, tenantId, id);
    await tx.billOfMaterials.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'BillOfMaterials',
      entityId: id,
      action: AUDIT_ACTIONS.BOM_DELETED,
    }).catch(() => {});

    return { id };
  });
}

// ── Production logging ───────────────────────────────────────────────────────

export interface ProductionPlanView {
  bomId: string;
  variantId: string;
  quantity: number;
  consumption: ConsumptionLine[];
  sufficient: boolean;
}

/**
 * Compute the consumption plan for a proposed production run without mutating
 * anything — used by the UI to validate against available stock before commit.
 */
export async function planProduction(tenantId: string, bomId: string, quantity: number) {
  const bom = await findOwnedBom(prisma, tenantId, bomId);
  const ingredients = bom.items.map(toBomIngredient);
  const consumption = computeConsumptionPlan(ingredients, quantity);
  return {
    bomId,
    variantId: bom.variantId,
    variantSku: bom.variant.sku,
    variantName: bom.variant.product.name,
    quantity,
    consumption,
    sufficient: !hasInsufficientIngredients(consumption),
  } satisfies ProductionPlanView & {
    variantSku: string;
    variantName: string;
  };
}

export async function produceGoods(
  tenantId: string,
  actorId: string,
  bomId: string,
  quantity: number,
  note?: string | undefined,
) {
  return prisma.$transaction(async (tx) => {
    const bom = await findOwnedBom(tx, tenantId, bomId);
    if (!bom.isActive) throw new Error('BOM_INACTIVE');
    if (!isSourceEligibleForProduction(bom.variant.product.productSource)) {
      throw new Error('TRADED_NOT_MANUFACTURED');
    }

    const ingredients = bom.items.map(toBomIngredient);
    const consumption = computeConsumptionPlan(ingredients, quantity);
    if (hasInsufficientIngredients(consumption)) {
      const short = getInsufficientIngredients(consumption);
      throw new Error(
        `INSUFFICIENT_STOCK:${short
          .map((s) => `${s.rawMaterialName}:${s.required}:${s.available}`)
          .join('|')}`,
      );
    }

    // 1) Deduct each raw material within the same transaction.
    for (const line of consumption) {
      await tx.rawMaterial.update({
        where: { id: line.rawMaterialId },
        data: {
          quantity: {
            decrement: new Prisma.Decimal(line.required),
          },
        },
      });
    }

    // 2) Add finished-good stock + record a MANUFACTURED stock movement.
    await adjustStockInTx(tx, tenantId, bom.variantId, actorId, {
      quantityDelta: quantity,
      reason: 'MANUFACTURED',
      note: note?.trim() || `Produced ${quantity} unit(s) via BOM ${bom.name}`,
    });

    // 3) Record the production log for reconciliation.
    const log = await tx.productionLog.create({
      data: {
        tenantId,
        bomId,
        variantId: bom.variantId,
        quantity,
        actorId,
        note: note?.trim() || null,
      },
    });

    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'ProductionLog',
      entityId: log.id,
      action: AUDIT_ACTIONS.PRODUCTION_LOGGED,
      after: {
        bomId,
        variantId: bom.variantId,
        quantity,
        consumption: consumption.map((c) => ({
          rawMaterialId: c.rawMaterialId,
          required: c.required,
        })),
      },
    }).catch(() => {});

    return {
      productionLogId: log.id,
      quantity,
      consumption,
    };
  });
}

// ── Production history ───────────────────────────────────────────────────────

export interface ProductionHistoryItem {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
  actorName: string;
  variantSku: string;
  variantName: string;
}

export async function listProductionLogs(
  tenantId: string,
  filters: { bomId?: string; variantId?: string; page?: number; limit?: number } = {},
) {
  const { bomId, variantId, page = 1, limit = 25 } = filters;
  const where: Prisma.ProductionLogWhereInput = { tenantId };
  if (bomId) where.bomId = bomId;
  if (variantId) where.variantId = variantId;

  const [rows, total] = await Promise.all([
    prisma.productionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        bom: { select: { name: true } },
        variant: {
          select: { sku: true, product: { select: { name: true } } },
        },
        actor: { select: { email: true } },
      },
    }),
    prisma.productionLog.count({ where }),
  ]);

  const items: ProductionHistoryItem[] = rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    note: row.note,
    createdAt: row.createdAt,
    actorName: row.actor.email,
    variantSku: row.variant.sku,
    variantName: row.variant.product.name,
  }));

  return { items, total };
}
