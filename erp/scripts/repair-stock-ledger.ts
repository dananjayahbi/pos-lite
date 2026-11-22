/* eslint-disable no-console -- repair CLI: prints exactly what it would/did write */
/**
 * Stock ledger repair (ARGUS #198) — DRY RUN BY DEFAULT.
 *
 * The audit (`scripts/audit-stock-ledger.ts`) separates two failure classes:
 *
 *   1. chain breaks — a row starts where the previous row did not end. These
 *      need a historical row at a known point in time, which cannot be invented
 *      retroactively, so this script never touches them (manual review).
 *   2. current mismatches — `ProductVariant.stockQuantity` differs from the last
 *      movement's `quantityAfter`. This script appends ONE explicit
 *      `DATA_ERROR` movement for that delta.
 *
 * Existing rows are NEVER updated or deleted. The appended row makes the ledger
 * explain the CURRENT quantity; it does not claim what actually happened
 * historically. Every write goes through `adjustStockInTx` in the same
 * transaction as a SYSTEM audit-log entry.
 *
 *   node --env-file=.env --import tsx scripts/repair-stock-ledger.ts
 *   node --env-file=.env --import tsx scripts/repair-stock-ledger.ts --tenant=<tenantId>
 *   node --env-file=.env --import tsx scripts/repair-stock-ledger.ts --apply
 *
 * Variants whose current stock already equals the ledger tail are skipped.
 * The delta is recomputed inside the write transaction, so a concurrent stock
 * change (sale, adjustment) is respected rather than overwritten.
 */
import { prisma } from '@/lib/prisma';
import { adjustStockInTx } from '@/lib/services/inventory.service';
import {
  auditStockLedgerVariant,
  type LedgerMovementInput,
} from '@/lib/services/stockLedgerAudit.core';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const tenantId =
  argv.find((arg) => arg.startsWith('--tenant='))?.slice('--tenant='.length).trim() || undefined;

const SCRIPT = 'scripts/repair-stock-ledger.ts';
const REPAIR_REASON = 'DATA_ERROR' as const;

interface Candidate {
  tenantId: string;
  tenantName: string;
  variantId: string;
  sku: string;
  productName: string | null;
  currentQuantity: number;
  ledgerTail: number | null;
  /** currentQuantity - ledgerTail, from the audit snapshot. */
  delta: number;
  chainBreaks: number;
  arithmeticErrors: number;
}

type RepairOutcome =
  | { status: 'repaired'; delta: number; ledgerTail: number }
  | { status: 'reconciled' }
  | { status: 'manual'; reason: string }
  | { status: 'failed'; reason: string };

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

async function collectCandidates(): Promise<Candidate[]> {
  const tenants = tenantId
    ? await prisma.tenant.findMany({ where: { id: tenantId }, select: { id: true, name: true } })
    : await prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

  const candidates: Candidate[] = [];

  for (const tenant of tenants) {
    const variants = await prisma.productVariant.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        product: { select: { name: true } },
      },
      orderBy: { sku: 'asc' },
    });
    if (variants.length === 0) continue;

    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: tenant.id, variantId: { in: variants.map((variant) => variant.id) } },
      select: {
        id: true,
        variantId: true,
        reason: true,
        quantityDelta: true,
        quantityBefore: true,
        quantityAfter: true,
        createdAt: true,
        note: true,
      },
      orderBy: [{ variantId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    const byVariant = new Map<string, LedgerMovementInput[]>();
    for (const movement of movements) {
      const rows = byVariant.get(movement.variantId);
      if (rows) rows.push(movement);
      else byVariant.set(movement.variantId, [movement]);
    }

    for (const variant of variants) {
      const audit = auditStockLedgerVariant({
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.product?.name ?? null,
        currentQuantity: variant.stockQuantity,
        movements: byVariant.get(variant.id) ?? [],
      });

      if (audit.repairDelta === null) continue;

      candidates.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.product?.name ?? null,
        currentQuantity: variant.stockQuantity,
        ledgerTail: audit.lastQuantityAfter,
        delta: audit.repairDelta,
        chainBreaks: audit.chainBreaks.length,
        arithmeticErrors: audit.arithmeticErrors.length,
      });
    }
  }

  return candidates;
}

async function repairCandidate(candidate: Candidate): Promise<RepairOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: candidate.variantId },
        select: { stockQuantity: true, tenantId: true },
      });
      if (!variant || variant.tenantId !== candidate.tenantId) {
        return { status: 'manual' as const, reason: 'variant no longer exists for this tenant' };
      }

      const last = await tx.stockMovement.findFirst({
        where: { variantId: candidate.variantId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { quantityAfter: true },
      });
      const ledgerTail = last?.quantityAfter ?? 0;
      const delta = variant.stockQuantity - ledgerTail;

      if (delta === 0) return { status: 'reconciled' as const };
      // A negative tail means the ledger itself is corrupt; appending cannot fix it.
      if (ledgerTail < 0) {
        return { status: 'manual' as const, reason: `ledger tail is negative (${ledgerTail})` };
      }

      const note =
        `Stock ledger reconciliation (ARGUS #198, ${SCRIPT}): ledger ended at ${ledgerTail}, ` +
        `current stock ${variant.stockQuantity}, appended ${formatDelta(delta)}. ` +
        `Synthetic correction - not a historical provenance record.`;

      await adjustStockInTx(tx, candidate.tenantId, candidate.variantId, null, {
        quantityDelta: delta,
        reason: REPAIR_REASON,
        note,
      });

      await tx.auditLog.create({
        data: {
          tenantId: candidate.tenantId,
          actorId: null,
          actorRole: 'SYSTEM',
          entityType: 'Stock',
          entityId: candidate.variantId,
          action: 'STOCK_LEDGER_REPAIRED',
          before: {
            ledgerTail,
            currentStock: variant.stockQuantity,
            lastMovementAfter: last?.quantityAfter ?? null,
          },
          after: {
            appendedDelta: delta,
            reason: REPAIR_REASON,
            script: SCRIPT,
            note,
          },
        },
      });

      return { status: 'repaired' as const, delta, ledgerTail };
    });
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

async function main(): Promise<void> {
  const candidates = await collectCandidates();

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'}: ${candidates.length} variant(s) whose current stock ` +
      `disagrees with the ledger tail${tenantId ? ` (tenant ${tenantId})` : ''}.`,
  );
  console.log('Existing movements are never rewritten; one DATA_ERROR row is appended per variant.');
  console.log('');

  if (candidates.length === 0) {
    console.log('Nothing to repair. No rows were written.');
    return;
  }

  for (const candidate of candidates) {
    console.log(
      [
        candidate.sku,
        candidate.productName ?? '-',
        `current=${candidate.currentQuantity}`,
        `ledger=${candidate.ledgerTail ?? 'none'}`,
        `delta=${formatDelta(candidate.delta)}`,
        candidate.chainBreaks > 0 ? `chainBreaks=${candidate.chainBreaks}` : null,
        candidate.arithmeticErrors > 0 ? `arithmeticErrors=${candidate.arithmeticErrors}` : null,
      ]
        .filter(Boolean)
        .join('  '),
    );
  }
  console.log('');

  if (!apply) {
    console.log('Dry run only - no rows were changed. Re-run with --apply to append the corrections.');
    return;
  }

  let repaired = 0;
  let reconciled = 0;
  let manual = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const outcome = await repairCandidate(candidate);
    switch (outcome.status) {
      case 'repaired':
        repaired += 1;
        console.log(
          `APPENDED DATA_ERROR ${formatDelta(outcome.delta)}  ${candidate.sku}  ` +
            `(${outcome.ledgerTail} -> ${candidate.currentQuantity})`,
        );
        if (candidate.chainBreaks > 0 || candidate.arithmeticErrors > 0) {
          console.log(
            `  note: ${candidate.chainBreaks} earlier chain break(s), ${candidate.arithmeticErrors} ` +
              'arithmetic error(s) remain - history still needs manual review.',
          );
        }
        break;
      case 'reconciled':
        reconciled += 1;
        console.log(`SKIPPED ${candidate.sku} - already reconciled by a concurrent change.`);
        break;
      case 'manual':
        manual += 1;
        console.log(`MANUAL ${candidate.sku} - ${outcome.reason}`);
        break;
      case 'failed':
        failed += 1;
        console.log(`FAILED ${candidate.sku} - ${outcome.reason}`);
        break;
    }
  }

  console.log('');
  console.log(
    `Done: ${repaired} repaired, ${reconciled} already reconciled, ${manual} manual, ${failed} failed.`,
  );

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Stock ledger repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
