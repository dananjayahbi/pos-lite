/* eslint-disable no-console -- repair CLI: prints exactly what it would/did write */
/**
 * Production batch repair (ARGUS #253) - DRY RUN BY DEFAULT.
 *
 * Legacy production runs created a `ProductionLog` and a MANUFACTURED
 * `StockMovement`, but no `BatchTracking` row, so the movement's `batchId` is
 * NULL and the production audit has no batch fields. The current service always
 * creates the batch; this script repairs the historical rows.
 *
 * It NEVER rewrites quantities or stock balances. For each safely matched run it
 * only:
 *   1. creates the missing MANUFACTURED batch (quantity copied from the log),
 *      or reuses the batch if a previous attempt created it but failed to link,
 *   2. sets `StockMovement.batchId`,
 *   3. writes a SYSTEM audit row (`PRODUCTION_BATCH_REPAIRED`).
 *
 * Matching rules live in `productionBatchRepair.core.ts`; runs where the
 * movement cannot be identified with certainty are printed as MANUAL and left
 * untouched.
 *
 *   node --env-file=.env --import tsx scripts/repair-production-batches.ts
 *   node --env-file=.env --import tsx scripts/repair-production-batches.ts --tenant=<tenantId>
 *   node --env-file=.env --import tsx scripts/repair-production-batches.ts --log=<productionLogId>
 *   node --env-file=.env --import tsx scripts/repair-production-batches.ts --apply
 *
 * `--log` can be repeated or comma-separated for per-run repairs.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import {
  planProductionBatchRepairs,
  type PlannedProductionBatchRepair,
  type ProductionBatchRepairPlan,
} from '@/lib/services/productionBatchRepair.core';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const tenantId =
  argv.find((arg) => arg.startsWith('--tenant='))?.slice('--tenant='.length).trim() || undefined;
const requestedLogIds = argv
  .filter((arg) => arg.startsWith('--log='))
  .flatMap((arg) => arg.slice('--log='.length).split(','))
  .map((value) => value.trim())
  .filter(Boolean);

const SCRIPT = 'scripts/repair-production-batches.ts';

interface TenantPlan {
  tenantId: string;
  tenantName: string;
  plan: ProductionBatchRepairPlan;
  /** Display metadata for the logs in the plan. */
  logInfo: Map<string, { sku: string; productName: string }>;
}

type ApplyOutcome =
  | { status: 'repaired'; batchNumber: string; reused: boolean }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

async function collectTenants() {
  if (tenantId) {
    return prisma.tenant.findMany({ where: { id: tenantId }, select: { id: true, name: true } });
  }
  return prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function collectPlan(tenant: { id: string; name: string }): Promise<TenantPlan | null> {
  const logs = await prisma.productionLog.findMany({
    where: {
      tenantId: tenant.id,
      ...(requestedLogIds.length > 0 ? { id: { in: requestedLogIds } } : {}),
    },
    select: {
      id: true,
      variantId: true,
      quantity: true,
      createdAt: true,
      variant: { select: { sku: true, product: { select: { name: true } } } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (logs.length === 0) return null;

  const variantIds = [...new Set(logs.map((log) => log.variantId))];

  const [movements, batches] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        tenantId: tenant.id,
        reason: 'MANUFACTURED',
        variantId: { in: variantIds },
      },
      select: {
        id: true,
        variantId: true,
        quantityDelta: true,
        createdAt: true,
        batchId: true,
      },
    }),
    prisma.batchTracking.findMany({
      where: { tenantId: tenant.id, variantId: { in: variantIds } },
      select: { id: true, variantId: true, batchNumber: true },
    }),
  ]);

  const plan = planProductionBatchRepairs({ logs, movements, batches });
  const logInfo = new Map(
    logs.map((log) => [
      log.id,
      { sku: log.variant.sku, productName: log.variant.product.name },
    ]),
  );

  return { tenantId: tenant.id, tenantName: tenant.name, plan, logInfo };
}

function describeLog(tenantPlan: TenantPlan, logId: string, quantity: number): string {
  const info = tenantPlan.logInfo.get(logId);
  const sku = info?.sku ?? 'unknown-sku';
  const productName = info?.productName ?? '-';
  return `${sku} ${productName}  qty=${quantity}  log=${logId}`;
}

function needsWork(tenantPlan: TenantPlan): boolean {
  return tenantPlan.plan.repairs.length > 0 || tenantPlan.plan.skipped.some(
    (row) => row.reason !== 'HAS_BATCH',
  );
}

async function applyRepair(
  tenantPlan: TenantPlan,
  repair: PlannedProductionBatchRepair,
): Promise<ApplyOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize concurrent repairs of the same run, then re-read authoritative
      // rows. Planning happened outside the transaction, so every assumption
      // is re-checked here.
      await tx.$executeRawUnsafe(
        'SELECT id FROM "production_logs" WHERE "id" = $1 FOR UPDATE',
        repair.logId,
      );
      const log = await tx.productionLog.findUnique({
        where: { id: repair.logId },
        select: { id: true, tenantId: true, variantId: true, quantity: true, createdAt: true },
      });
      if (!log || log.tenantId !== tenantPlan.tenantId) {
        return { status: 'skipped' as const, reason: 'production log no longer exists for this tenant' };
      }
      if (log.variantId !== repair.variantId || log.quantity !== repair.quantity) {
        return { status: 'skipped' as const, reason: 'production log changed since planning' };
      }

      await tx.$executeRawUnsafe(
        'SELECT id FROM "stock_movements" WHERE "id" = $1 FOR UPDATE',
        repair.movementId,
      );
      const movement = await tx.stockMovement.findUnique({
        where: { id: repair.movementId },
        select: {
          id: true,
          tenantId: true,
          variantId: true,
          quantityDelta: true,
          reason: true,
          batchId: true,
        },
      });
      if (!movement || movement.tenantId !== log.tenantId) {
        return { status: 'skipped' as const, reason: 'stock movement no longer exists for this tenant' };
      }
      if (movement.batchId !== null) {
        return { status: 'skipped' as const, reason: 'movement was already linked to a batch' };
      }
      if (
        String(movement.reason) !== 'MANUFACTURED' ||
        movement.variantId !== log.variantId ||
        movement.quantityDelta !== log.quantity
      ) {
        return { status: 'skipped' as const, reason: 'movement no longer matches the production log' };
      }

      let batch = await tx.batchTracking.findUnique({
        where: {
          tenantId_variantId_batchNumber: {
            tenantId: log.tenantId,
            variantId: log.variantId,
            batchNumber: repair.batchNumber,
          },
        },
        select: { id: true, batchNumber: true },
      });
      let reused = batch !== null;

      if (!batch) {
        try {
          batch = await tx.batchTracking.create({
            data: {
              tenantId: log.tenantId,
              variantId: log.variantId,
              // Quantity is copied from the production log - never recomputed.
              quantity: log.quantity,
              batchNumber: repair.batchNumber,
              source: 'MANUFACTURED',
              receivedAt: log.createdAt,
            },
            select: { id: true, batchNumber: true },
          });
        } catch (error) {
          // A concurrent repair created the same batch first; reuse it.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            batch = await tx.batchTracking.findUnique({
              where: {
                tenantId_variantId_batchNumber: {
                  tenantId: log.tenantId,
                  variantId: log.variantId,
                  batchNumber: repair.batchNumber,
                },
              },
              select: { id: true, batchNumber: true },
            });
            reused = true;
          } else {
            throw error;
          }
        }
      }

      if (!batch) {
        return { status: 'failed' as const, reason: 'batch could not be created or resolved' };
      }

      await tx.stockMovement.update({
        where: { id: movement.id },
        data: { batchId: batch.id },
      });

      await tx.auditLog.create({
        data: {
          tenantId: log.tenantId,
          actorId: null,
          actorRole: 'SYSTEM',
          entityType: 'ProductionLog',
          entityId: log.id,
          action: 'PRODUCTION_BATCH_REPAIRED',
          before: {
            batchId: null,
            batchNumber: null,
            movementId: movement.id,
            quantity: log.quantity,
          },
          after: {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            movementId: movement.id,
            quantity: log.quantity,
            receivedAt: log.createdAt.toISOString(),
            reusedExistingBatch: reused,
            script: SCRIPT,
          },
        },
      });

      return { status: 'repaired' as const, batchNumber: batch.batchNumber, reused };
    });
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

async function main(): Promise<void> {
  const tenants = await collectTenants();
  if (tenants.length === 0) {
    console.log('No matching tenant found. No rows were changed.');
    return;
  }

  const tenantPlans: TenantPlan[] = [];
  for (const tenant of tenants) {
    const tenantPlan = await collectPlan(tenant);
    if (tenantPlan && needsWork(tenantPlan)) tenantPlans.push(tenantPlan);
  }

  if (requestedLogIds.length > 0) {
    const seen = new Set(tenantPlans.flatMap((tp) => [...tp.logInfo.keys()]));
    const missing = requestedLogIds.filter((id) => !seen.has(id));
    if (missing.length > 0) {
      console.log(`WARNING: ${missing.length} requested log id(s) not found: ${missing.join(', ')}`);
    }
  }

  const repairs = tenantPlans.reduce((sum, tp) => sum + tp.plan.repairs.length, 0);
  const manual = tenantPlans.reduce(
    (sum, tp) => sum + tp.plan.skipped.filter((row) => row.reason !== 'HAS_BATCH').length,
    0,
  );
  const orphans = tenantPlans.reduce((sum, tp) => sum + tp.plan.orphanMovementIds.length, 0);

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'}: ${repairs} production run(s) need a batch repair` +
      `${tenantId ? ` (tenant ${tenantId})` : ''}, ${manual} need manual review.`,
  );
  console.log('Quantities are never rewritten; only the missing batch and movement link are written.');
  console.log('');

  for (const tenantPlan of tenantPlans) {
    if (tenantPlan.plan.repairs.length === 0 && !needsWork(tenantPlan)) continue;
    console.log(`Tenant ${tenantPlan.tenantName} (${tenantPlan.tenantId})`);

    for (const repair of tenantPlan.plan.repairs) {
      console.log(
        `  REPAIR  ${describeLog(tenantPlan, repair.logId, repair.quantity)}  ` +
          `movement=${repair.movementId}  batch=${repair.batchNumber} ` +
          `(${repair.existingBatchId ? 'reuse existing' : 'create'})`,
      );
    }
    for (const skipped of tenantPlan.plan.skipped) {
      if (skipped.reason === 'HAS_BATCH') continue;
      console.log(
        `  MANUAL  ${describeLog(tenantPlan, skipped.logId, skipped.quantity)}  ` +
          `${skipped.reason}: ${skipped.detail}`,
      );
    }
  }

  console.log('');
  console.log(`Orphan unlinked MANUFACTURED movements left untouched: ${orphans}`);
  if (repairs === 0) {
    console.log('Nothing to repair automatically. No rows were changed.');
    return;
  }
  if (!apply) {
    console.log('Dry run only - no rows were changed. Re-run with --apply to write the repairs.');
    return;
  }

  let repaired = 0;
  let reused = 0;
  let skipped = 0;
  let failed = 0;

  for (const tenantPlan of tenantPlans) {
    for (const repair of tenantPlan.plan.repairs) {
      const outcome = await applyRepair(tenantPlan, repair);
      switch (outcome.status) {
        case 'repaired':
          repaired += 1;
          if (outcome.reused) reused += 1;
          console.log(
            `LINKED  ${describeLog(tenantPlan, repair.logId, repair.quantity)}  ` +
              `batch=${outcome.batchNumber}${outcome.reused ? ' (reused)' : ''}`,
          );
          break;
        case 'skipped':
          skipped += 1;
          console.log(
            `SKIPPED ${describeLog(tenantPlan, repair.logId, repair.quantity)} - ${outcome.reason}`,
          );
          break;
        case 'failed':
          failed += 1;
          console.log(
            `FAILED  ${describeLog(tenantPlan, repair.logId, repair.quantity)} - ${outcome.reason}`,
          );
          break;
      }
    }
  }

  console.log('');
  console.log(
    `Done: ${repaired} repaired (${reused} reused an existing batch), ` +
      `${skipped} skipped, ${failed} failed.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Production batch repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
