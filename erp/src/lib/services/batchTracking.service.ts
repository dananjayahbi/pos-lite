/**
 * Batch Tracking Service — create, query, and summarize batch records.
 *
 * A `BatchTracking` aggregates stock received (PURCHASE) or produced
 * (MANUFACTURED) under a single batch identifier with an optional expiry date.
 * This is the support layer for doc 29 (capture + linkage) and doc 30
 * (visibility + alerts).
 */
import { prisma } from '@/lib/prisma';
import type {
  BatchSource,
  Prisma,
} from '@/generated/prisma/client';
import type { TxClient } from '@/lib/services/inventory.service';
import { getBatchExpiryStatus, type BatchExpiryStatus } from '@/lib/services/batchTracking.core';

// ── Public Types ─────────────────────────────────────────────────────────────

export interface CreateBatchInput {
  tenantId: string;
  variantId: string;
  batchNumber: string;
  expiryDate?: Date | null;
  quantity: number;
  source?: BatchSource;
  /** Optional ISO date to backdate the receipt (defaults to now). */
  receivedAt?: Date;
}

export interface BatchListItem {
  id: string;
  variantId: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  source: BatchSource;
  receivedAt: string;
  sku: string;
  productName: string;
  variantLabel: string;
  expiryStatus: BatchExpiryStatus;
}

export interface GetBatchesFilters {
  variantId?: string;
  source?: BatchSource;
  expiryStatus?: BatchExpiryStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Transaction Helper: create a batch within an outer tx ────────────────────

/**
 * Create a `BatchTracking` row inside an existing transaction. Used by the
 * purchase-order receive flow so the batch and stock movement commit together.
 */
export async function createBatchInTx(
  tx: TxClient,
  input: CreateBatchInput,
): Promise<Prisma.BatchTrackingGetPayload<{}>> {
  const batch = await tx.batchTracking.create({
    data: {
      tenantId: input.tenantId,
      variantId: input.variantId,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate ?? null,
      quantity: input.quantity,
      source: input.source ?? 'PURCHASE',
      receivedAt: input.receivedAt ?? new Date(),
    },
  });
  return batch;
}

// ── Standalone: createBatch ──────────────────────────────────────────────────

export async function createBatch(input: CreateBatchInput) {
  return createBatchInTx(prisma as unknown as TxClient, input);
}

// ── Query: listBatches ───────────────────────────────────────────────────────

const BATCH_LIST_SELECT = {
  id: true,
  variantId: true,
  batchNumber: true,
  expiryDate: true,
  quantity: true,
  source: true,
  receivedAt: true,
  variant: {
    select: {
      sku: true,
      form: true,
      packSize: true,
      product: { select: { name: true } },
    },
  },
} satisfies Prisma.BatchTrackingSelect;

type BatchRow = Prisma.BatchTrackingGetPayload<{
  select: typeof BATCH_LIST_SELECT;
}>;

export async function listBatches(
  tenantId: string,
  filters: GetBatchesFilters = {},
): Promise<{ batches: BatchListItem[]; total: number }> {
  const { variantId, source, expiryStatus, search, page = 1, limit = 50 } = filters;

  const where: Prisma.BatchTrackingWhereInput = {
    tenantId,
    ...(variantId ? { variantId } : {}),
    ...(source ? { source } : {}),
    ...(search
      ? {
          OR: [
            { batchNumber: { contains: search, mode: 'insensitive' } },
            { variant: { sku: { contains: search, mode: 'insensitive' } } },
            { variant: { product: { name: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.batchTracking.findMany({
      where,
      select: BATCH_LIST_SELECT,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.batchTracking.count({ where }),
  ]);

  const batches = rows
    .map((row) => {
      const expiryStatus = getBatchExpiryStatus(row.expiryDate);
      return {
        id: row.id,
        variantId: row.variantId,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate ? row.expiryDate.toISOString() : null,
        quantity: row.quantity,
        source: row.source,
        receivedAt: row.receivedAt.toISOString(),
        sku: row.variant.sku,
        productName: row.variant.product.name,
        variantLabel: [row.variant.form, row.variant.packSize].filter(Boolean).join(' · ') || row.variant.sku,
        expiryStatus,
      };
    })
    .filter((b) => (expiryStatus ? b.expiryStatus === expiryStatus : true));

  return { batches, total };
}

// ── Query: getBatchById ──────────────────────────────────────────────────────

export async function getBatchById(tenantId: string, batchId: string) {
  return prisma.batchTracking.findFirst({
    where: { id: batchId, tenantId },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          form: true,
          packSize: true,
          stockQuantity: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ── Summary: getBatchStats ───────────────────────────────────────────────────

export interface BatchStats {
  totalBatches: number;
  expiredCount: number;
  expiringSoonCount: number;
  healthyCount: number;
}

export async function getBatchStats(tenantId: string): Promise<BatchStats> {
  const rows = await prisma.batchTracking.findMany({
    where: { tenantId },
    select: { id: true, expiryDate: true, quantity: true },
  });

  const stats: BatchStats = {
    totalBatches: rows.length,
    expiredCount: 0,
    expiringSoonCount: 0,
    healthyCount: 0,
  };

  for (const row of rows) {
    const status = getBatchExpiryStatus(row.expiryDate);
    if (status === 'EXPIRED') stats.expiredCount += 1;
    else if (status === 'EXPIRING_SOON') stats.expiringSoonCount += 1;
    else stats.healthyCount += 1;
  }

  return stats;
}

// ── Dedupe / upsert helper used by receipt capture ───────────────────────────

/**
 * Find an existing batch by (variantId, batchNumber) so receiving the same
 * batch across multiple PO lines accumulates quantity instead of duplicating.
 */
export async function findBatchByNumber(
  tx: TxClient,
  tenantId: string,
  variantId: string,
  batchNumber: string,
) {
  return tx.batchTracking.findFirst({
    where: { tenantId, variantId, batchNumber },
  });
}
