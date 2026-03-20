/**
 * Inventory Service Layer — sole entry point for all stock mutations.
 *
 * All changes to ProductVariant.stockQuantity must go through adjustStock or
 * bulkAdjustStock. Direct calls to prisma.productVariant.update or
 * prisma.productVariant.updateMany for the stockQuantity field are forbidden
 * outside this module. This is a convention enforced by code review.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { StockMovementReason, StockTakeStatus } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

// ── Transaction Client Type ──────────────────────────────────────────────────

export type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ── Input Types ──────────────────────────────────────────────────────────────

export interface AdjustStockOptions {
  quantityDelta: number;
  reason: StockMovementReason;
  note?: string | undefined;
  saleId?: string | undefined;
  purchaseOrderId?: string | undefined;
  stockTakeSessionId?: string | undefined;
}

export interface AdjustStockInput {
  tenantId: string;
  variantId: string;
  actorId: string;
  options: AdjustStockOptions;
}

export interface BulkAdjustStockInput {
  tenantId: string;
  actorId: string;
  adjustments: (AdjustStockOptions & { variantId: string })[];
}

export interface GetStockMovementsFilters {
  variantId?: string;
  reason?: StockMovementReason;
  from?: Date;
  to?: Date;
  actorId?: string;
  page?: number;
  limit?: number;
}

export interface CreateStockTakeSessionInput {
  categoryId?: string;
  notes?: string;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
}

// ── Private Helper: Core Adjust Logic ────────────────────────────────────────

export async function adjustStockInTx(
  tx: TxClient,
  tenantId: string,
  variantId: string,
  actorId: string,
  options: AdjustStockOptions,
) {
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { stockQuantity: true, tenantId: true },
  });

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  if (variant.tenantId !== tenantId) {
    throw new Error('Authorization error: variant does not belong to this tenant');
  }

  const currentQty = variant.stockQuantity;
  const newQuantity = currentQty + options.quantityDelta;

  if (newQuantity < 0) {
    throw new Error(
      `Insufficient stock: attempting to reduce by ${Math.abs(options.quantityDelta)} but only ${currentQty} units available`,
    );
  }

  const updated = await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: newQuantity },
  });

  await tx.stockMovement.create({
    data: {
      tenantId,
      variantId,
      reason: options.reason,
      quantityDelta: options.quantityDelta,
      quantityBefore: currentQty,
      quantityAfter: newQuantity,
      actorId,
      note: options.note ?? null,
      saleId: options.saleId ?? null,
      purchaseOrderId: options.purchaseOrderId ?? null,
      stockTakeSessionId: options.stockTakeSessionId ?? null,
    },
  });

  return updated;
}

// ── Step 2: adjustStock ──────────────────────────────────────────────────────

export async function adjustStock(input: AdjustStockInput) {
  return prisma.$transaction(async (tx) => {
    return adjustStockInTx(tx, input.tenantId, input.variantId, input.actorId, input.options);
  });
}

// ── Step 3: bulkAdjustStock ──────────────────────────────────────────────────

export async function bulkAdjustStock(input: BulkAdjustStockInput) {
  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const adj of input.adjustments) {
      const result = await adjustStockInTx(tx, input.tenantId, adj.variantId, input.actorId, {
        quantityDelta: adj.quantityDelta,
        reason: adj.reason,
        note: adj.note,
        saleId: adj.saleId,
        purchaseOrderId: adj.purchaseOrderId,
        stockTakeSessionId: adj.stockTakeSessionId,
      });
      results.push(result);
    }
    return results;
  });
}

// ── Step 4: getStockMovements ────────────────────────────────────────────────

export async function getStockMovements(
  tenantId: string,
  filters: GetStockMovementsFilters = {},
) {
  const { variantId, reason, from, to, actorId, page = 1, limit = 30 } = filters;

  const where: Prisma.StockMovementWhereInput = { tenantId };

  if (variantId) where.variantId = variantId;
  if (reason) where.reason = reason;
  if (actorId) where.actorId = actorId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const skip = (page - 1) * limit;

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, email: true } },
        variant: {
          select: {
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
      skip,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { movements, total };
}

// ── Step 5: createStockTakeSession ───────────────────────────────────────────

export async function createStockTakeSession(
  tenantId: string,
  actorId: string,
  options: CreateStockTakeSessionInput = {},
) {
  const { categoryId, notes } = options;

  return prisma.$transaction(async (tx) => {
    if (categoryId) {
      const category = await tx.category.findUnique({
        where: { id: categoryId },
        select: { tenantId: true },
      });
      if (!category || category.tenantId !== tenantId) {
        throw new Error('Category not found or does not belong to this tenant');
      }
    }

    const session = await tx.stockTakeSession.create({
      data: {
        tenantId,
        status: 'IN_PROGRESS',
        initiatedById: actorId,
        startedAt: new Date(),
        categoryId: categoryId ?? null,
        notes: notes ?? null,
      },
    });

    let itemCount = 0;

    if (categoryId) {
      const variants = await tx.productVariant.findMany({
        where: {
          tenantId,
          deletedAt: null,
          product: { categoryId, deletedAt: null },
        },
        select: { id: true, stockQuantity: true },
      });

      if (variants.length > 0) {
        await tx.stockTakeItem.createMany({
          data: variants.map((v) => ({
            sessionId: session.id,
            variantId: v.id,
            systemQuantity: v.stockQuantity,
          })),
        });
        itemCount = variants.length;
      }
    }

    return { session, itemCount };
  });
}

// ── Step 6: addStockTakeItem ─────────────────────────────────────────────────

export async function addStockTakeItem(
  sessionId: string,
  tenantId: string,
  variantId: string,
) {
  const session = await prisma.stockTakeSession.findUnique({
    where: { id: sessionId },
    select: { tenantId: true, status: true },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error('Stock take session not found or does not belong to this tenant');
  }
  if (session.status !== 'IN_PROGRESS') {
    throw new Error('Stock take session is not in progress');
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { tenantId: true, stockQuantity: true },
  });

  if (!variant || variant.tenantId !== tenantId) {
    throw new Error('Variant not found or does not belong to this tenant');
  }

  const existing = await prisma.stockTakeItem.findUnique({
    where: { sessionId_variantId: { sessionId, variantId } },
  });

  if (existing) return existing;

  return prisma.stockTakeItem.create({
    data: {
      sessionId,
      variantId,
      systemQuantity: variant.stockQuantity,
    },
  });
}

// ── Step 7: updateStockTakeItem ──────────────────────────────────────────────

export async function updateStockTakeItem(
  sessionId: string,
  itemId: string,
  countedQuantity: number,
) {
  if (countedQuantity < 0) {
    throw new Error('Counted quantity cannot be negative');
  }

  const item = await prisma.stockTakeItem.findUnique({
    where: { id: itemId },
    select: { sessionId: true, systemQuantity: true },
  });

  if (!item || item.sessionId !== sessionId) {
    throw new Error('Stock take item not found or does not belong to this session');
  }

  const session = await prisma.stockTakeSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  if (!session || session.status !== 'IN_PROGRESS') {
    throw new Error('Stock take session is not in progress');
  }

  const discrepancy = countedQuantity - item.systemQuantity;

  return prisma.stockTakeItem.update({
    where: { id: itemId },
    data: { countedQuantity, discrepancy, updatedAt: new Date() },
  });
}

// ── Step 8: completeStockTakeSession ─────────────────────────────────────────

export async function completeStockTakeSession(
  sessionId: string,
  tenantId: string,
  actorId: string,
) {
  const session = await prisma.stockTakeSession.findUnique({
    where: { id: sessionId },
    select: { tenantId: true, status: true, initiatedById: true },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error('Stock take session not found or does not belong to this tenant');
  }
  if (session.status !== 'IN_PROGRESS') {
    throw new Error('Stock take session is not in progress');
  }
  if (session.initiatedById !== actorId) {
    throw new Error('Only the initiator can complete the stock take session');
  }

  const items = await prisma.stockTakeItem.findMany({
    where: { sessionId },
    include: { variant: { select: { sku: true } } },
  });

  const uncounted = items.filter((i) => i.countedQuantity === null);
  if (uncounted.length > 0) {
    const skus = uncounted.map((i) => i.variant.sku).join(', ');
    throw new Error(`Cannot complete: uncounted items remain — ${skus}`);
  }

  const updated = await prisma.stockTakeSession.update({
    where: { id: sessionId },
    data: { status: 'PENDING_APPROVAL', completedAt: new Date() },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'STAFF',
    entityType: 'StockTakeSession',
    entityId: sessionId,
    action: 'STOCK_TAKE_COMPLETED',
  });

  return updated;
}

// ── Step 9: approveStockTake ─────────────────────────────────────────────────

export async function approveStockTake(
  sessionId: string,
  tenantId: string,
  actorId: string,
) {
  const session = await prisma.stockTakeSession.findUnique({
    where: { id: sessionId },
    select: { tenantId: true, status: true },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error('Stock take session not found or does not belong to this tenant');
  }
  if (session.status !== 'PENDING_APPROVAL') {
    throw new Error('Stock take session is not pending approval');
  }

  const items = await prisma.stockTakeItem.findMany({
    where: { sessionId, NOT: { discrepancy: 0 } },
    select: { variantId: true, discrepancy: true },
  });

  // Filter only non-zero and non-null discrepancies
  const adjustmentsToMake = items.filter(
    (i): i is typeof i & { discrepancy: number } => i.discrepancy !== null && i.discrepancy !== 0,
  );

  const result = await prisma.$transaction(async (tx) => {
    for (const item of adjustmentsToMake) {
      await adjustStockInTx(tx, tenantId, item.variantId, actorId, {
        quantityDelta: item.discrepancy,
        reason: 'STOCK_TAKE_ADJUSTMENT',
        stockTakeSessionId: sessionId,
      });
    }

    return tx.stockTakeSession.update({
      where: { id: sessionId },
      data: {
        status: 'APPROVED',
        approvedById: actorId,
        approvedAt: new Date(),
      },
    });
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'STAFF',
    entityType: 'StockTakeSession',
    entityId: sessionId,
    action: 'STOCK_TAKE_APPROVED',
    after: { adjustmentCount: adjustmentsToMake.length },
  });

  return { session: result, adjustmentCount: adjustmentsToMake.length };
}

// ── Step 10: rejectStockTake ─────────────────────────────────────────────────

export async function rejectStockTake(
  sessionId: string,
  tenantId: string,
  actorId: string,
  reason: string,
) {
  const session = await prisma.stockTakeSession.findUnique({
    where: { id: sessionId },
    select: { tenantId: true, status: true, notes: true },
  });

  if (!session || session.tenantId !== tenantId) {
    throw new Error('Stock take session not found or does not belong to this tenant');
  }
  if (session.status !== 'PENDING_APPROVAL') {
    throw new Error('Stock take session is not pending approval');
  }

  const updatedNotes = session.notes ? `${session.notes}\nRejection reason: ${reason}` : `Rejection reason: ${reason}`;

  const updated = await prisma.stockTakeSession.update({
    where: { id: sessionId },
    data: {
      status: 'REJECTED',
      approvedById: actorId,
      approvedAt: new Date(),
      notes: updatedNotes,
    },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'STAFF',
    entityType: 'StockTakeSession',
    entityId: sessionId,
    action: 'STOCK_TAKE_REJECTED',
    after: { reason },
  });

  return updated;
}

// ── Step 11: getLowStockVariants ──────────────────────────────────────────────

export async function getLowStockVariants(
  tenantId: string,
  pagination: PaginationInput = {},
) {
  const { page = 1, limit = 30 } = pagination;
  const offset = (page - 1) * limit;

  const variants = await prisma.$queryRaw<
    {
      id: string;
      sku: string;
      stockQuantity: number;
      lowStockThreshold: number;
      productName: string;
      categoryName: string;
    }[]
  >(
    Prisma.sql`
      SELECT
        pv."id",
        pv."sku",
        pv."stockQuantity",
        pv."lowStockThreshold",
        p."name" AS "productName",
        c."name" AS "categoryName"
      FROM "product_variants" pv
      JOIN "products" p ON p."id" = pv."productId"
      JOIN "categories" c ON c."id" = p."categoryId"
      WHERE pv."tenantId" = ${tenantId}
        AND pv."deletedAt" IS NULL
        AND pv."stockQuantity" <= pv."lowStockThreshold"
      ORDER BY
        CASE WHEN pv."lowStockThreshold" = 0 THEN 0
             ELSE pv."stockQuantity"::float / pv."lowStockThreshold"::float
        END ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
  );

  const totalResult = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "product_variants" pv
      WHERE pv."tenantId" = ${tenantId}
        AND pv."deletedAt" IS NULL
        AND pv."stockQuantity" <= pv."lowStockThreshold"
    `,
  );

  const total = Number(totalResult[0]?.count ?? 0);

  return { variants, total };
}

// ── Step 12: getStockValuation ───────────────────────────────────────────────

export async function getStockValuation(tenantId: string) {
  const result = await prisma.$queryRaw<
    { totalCostValue: Prisma.Decimal; totalRetailValue: Prisma.Decimal }[]
  >(
    Prisma.sql`
      SELECT
        COALESCE(SUM("costPrice" * "stockQuantity"), 0) AS "totalCostValue",
        COALESCE(SUM("retailPrice" * "stockQuantity"), 0) AS "totalRetailValue"
      FROM "product_variants"
      WHERE "tenantId" = ${tenantId}
        AND "deletedAt" IS NULL
        AND "stockQuantity" > 0
    `,
  );

  return {
    totalCostValue: result[0]?.totalCostValue ?? new Prisma.Decimal(0),
    totalRetailValue: result[0]?.totalRetailValue ?? new Prisma.Decimal(0),
  };
}
