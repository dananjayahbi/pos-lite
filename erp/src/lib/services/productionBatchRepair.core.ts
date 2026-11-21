/**
 * ARGUS #253 - pure planner for repairing legacy production runs that never got
 * a batch record (and whose MANUFACTURED stock movement therefore has
 * `batchId = null`).
 *
 * The current `produceGoods` service always creates the batch, so this only
 * applies to historical rows. The repair must never rewrite quantities: it may
 * only create the missing batch (quantity copied from the production log) and
 * link the existing movement.
 *
 * Matching is deliberately conservative:
 * - the movement must belong to the same tenant variant and be MANUFACTURED,
 * - its `quantityDelta` must equal the production-log quantity,
 * - it must be unlinked (`batchId = null`),
 * - its timestamp must sit inside a small window around the log (both rows are
 *   written in the same transaction, so they normally share a timestamp),
 * - exactly ONE candidate must match. Two identical runs close together are
 *   reported as manual instead of being paired by guesswork.
 *
 * A log is already repaired when its batch number suffix (derived from the log
 * id by `buildProductionBatchNumber`) exists AND a movement links to that
 * batch. If the batch exists but the link is missing (a crash between batch
 * creation and the movement update), the plan links the existing batch instead
 * of creating a duplicate.
 */
import { buildProductionBatchNumber } from '@/lib/services/bom.core';

export interface ProductionBatchRepairLog {
  id: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
}

export interface ProductionBatchRepairMovement {
  id: string;
  variantId: string;
  quantityDelta: number;
  createdAt: Date;
  batchId: string | null;
}

export interface ProductionBatchRepairBatch {
  id: string;
  variantId: string;
  batchNumber: string;
}

export const PRODUCTION_BATCH_MATCH_WINDOW_MS = 10 * 60 * 1000;
/** Tolerate a movement timestamp a little before the log (clock skew). */
export const PRODUCTION_BATCH_CLOCK_SKEW_MS = 60 * 1000;

export type ProductionBatchSkipReason =
  | 'HAS_BATCH'
  | 'NO_MOVEMENT'
  | 'QUANTITY_MISMATCH'
  | 'AMBIGUOUS_MOVEMENT';

export interface PlannedProductionBatchRepair {
  logId: string;
  variantId: string;
  quantity: number;
  movementId: string;
  batchNumber: string;
  /** Set when the batch already exists and only the movement link is missing. */
  existingBatchId: string | null;
}

export interface SkippedProductionLog {
  logId: string;
  variantId: string;
  quantity: number;
  reason: ProductionBatchSkipReason;
  detail: string;
}

export interface ProductionBatchRepairPlan {
  repairs: PlannedProductionBatchRepair[];
  skipped: SkippedProductionLog[];
  /** Unlinked MANUFACTURED movements no log could claim; never touched. */
  orphanMovementIds: string[];
}

export interface PlanProductionBatchRepairsInput {
  logs: readonly ProductionBatchRepairLog[];
  movements: readonly ProductionBatchRepairMovement[];
  batches: readonly ProductionBatchRepairBatch[];
  matchWindowMs?: number;
  clockSkewMs?: number;
}

/**
 * The suffix of the batch number generated from a production-log id. Mirrors
 * `buildProductionBatchNumber()` without needing the run date (a legacy run may
 * have crossed midnight, so only the suffix is stable).
 */
export function productionBatchSuffix(logId: string): string {
  return (
    logId
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8)
      .toUpperCase() || 'BATCH'
  );
}

/** True when a batch number belongs to the given production log. */
export function batchNumberMatchesLog(batchNumber: string, logId: string): boolean {
  return batchNumber.endsWith(`-${productionBatchSuffix(logId)}`);
}

function byCreatedAtThenId(
  a: { id: string; createdAt: Date },
  b: { id: string; createdAt: Date },
): number {
  const delta = a.createdAt.getTime() - b.createdAt.getTime();
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

export function planProductionBatchRepairs(
  input: PlanProductionBatchRepairsInput,
): ProductionBatchRepairPlan {
  const windowMs = input.matchWindowMs ?? PRODUCTION_BATCH_MATCH_WINDOW_MS;
  const skewMs = input.clockSkewMs ?? PRODUCTION_BATCH_CLOCK_SKEW_MS;

  const movements = [...input.movements].sort(byCreatedAtThenId);
  const logs = [...input.logs].sort(byCreatedAtThenId);
  const claimedMovementIds = new Set<string>();
  const usedBatchIds = new Set<string>();

  const repairs: PlannedProductionBatchRepair[] = [];
  const skipped: SkippedProductionLog[] = [];

  const withinWindow = (movementAt: Date, logAt: Date): boolean => {
    const delta = movementAt.getTime() - logAt.getTime();
    return delta >= -skewMs && delta <= windowMs;
  };

  for (const log of logs) {
    const existingBatch = input.batches.find(
      (batch) =>
        batch.variantId === log.variantId &&
        !usedBatchIds.has(batch.id) &&
        batchNumberMatchesLog(batch.batchNumber, log.id),
    );

    const batchAlreadyLinked =
      existingBatch !== undefined &&
      movements.some((movement) => movement.batchId === existingBatch.id);

    if (existingBatch && batchAlreadyLinked) {
      usedBatchIds.add(existingBatch.id);
      skipped.push({
        logId: log.id,
        variantId: log.variantId,
        quantity: log.quantity,
        reason: 'HAS_BATCH',
        detail: `already linked to batch ${existingBatch.batchNumber}`,
      });
      continue;
    }

    const sameVariantUnlinked = movements.filter(
      (movement) =>
        !claimedMovementIds.has(movement.id) &&
        movement.batchId === null &&
        movement.variantId === log.variantId &&
        withinWindow(movement.createdAt, log.createdAt),
    );

    const candidates = sameVariantUnlinked.filter(
      (movement) => movement.quantityDelta === log.quantity,
    );

    if (candidates.length === 0) {
      const quantities = [...new Set(sameVariantUnlinked.map((m) => m.quantityDelta))];
      skipped.push({
        logId: log.id,
        variantId: log.variantId,
        quantity: log.quantity,
        reason: quantities.length > 0 ? 'QUANTITY_MISMATCH' : 'NO_MOVEMENT',
        detail:
          quantities.length > 0
            ? `no unlinked MANUFACTURED movement for quantity ${log.quantity} (saw ${quantities.join(', ')})`
            : 'no unlinked MANUFACTURED stock movement near this run',
      });
      continue;
    }

    if (candidates.length > 1) {
      skipped.push({
        logId: log.id,
        variantId: log.variantId,
        quantity: log.quantity,
        reason: 'AMBIGUOUS_MOVEMENT',
        detail: `${candidates.length} unlinked movements match this run (${candidates
          .map((movement) => movement.id)
          .join(', ')}) - resolve manually`,
      });
      continue;
    }

    const movement = candidates[0]!;
    claimedMovementIds.add(movement.id);
    if (existingBatch) usedBatchIds.add(existingBatch.id);

    repairs.push({
      logId: log.id,
      variantId: log.variantId,
      quantity: log.quantity,
      movementId: movement.id,
      batchNumber: existingBatch?.batchNumber ?? buildProductionBatchNumber(log.id, log.createdAt),
      existingBatchId: existingBatch?.id ?? null,
    });
  }

  const orphanMovementIds = movements
    .filter((movement) => movement.batchId === null && !claimedMovementIds.has(movement.id))
    .map((movement) => movement.id);

  return { repairs, skipped, orphanMovementIds };
}
