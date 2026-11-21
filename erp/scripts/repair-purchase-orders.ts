/* eslint-disable no-console -- repair CLI: prints exactly what it would/did write */
/**
 * Purchase-order data repair (ARGUS #232) - DRY RUN BY DEFAULT.
 *
 * Demo/legacy seed rows were created without a `subtotalAmount` (it kept the 0
 * default) and their stock was incremented directly, bypassing the receipt
 * service, so already-received POs have no `PURCHASE_RECEIVED` movement. This
 * script rebuilds those two derived facts from the rows themselves:
 *
 *   1. subtotal = sum(orderedQty x expectedCostPrice), only when the stored
 *      total still equals subtotal - discount;
 *   2. one PURCHASE_RECEIVED movement per received line, only when the stock
 *      already includes the receipt (`currentStock - ledgerTail == receivedQty`)
 *      so the movement closes the ledger without changing stock.
 *
 * Anything ambiguous (a total that disagrees with the lines, later ledger
 * activity, an existing receipt) is reported for manual review and NOT written.
 * Existing rows are never updated except `subtotalAmount`; stock is never
 * adjusted and no receipt line/status is changed.
 *
 *   node --env-file=.env --import tsx scripts/repair-purchase-orders.ts
 *   node --env-file=.env --import tsx scripts/repair-purchase-orders.ts --tenant=<tenantId>
 *   node --env-file=.env --import tsx scripts/repair-purchase-orders.ts --po=<purchaseOrderId>
 *   node --env-file=.env --import tsx scripts/repair-purchase-orders.ts --apply
 *
 * Re-running is idempotent: a repaired subtotal plans as `ok` and an existing
 * receipt movement plans as `already`.
 */
import { prisma } from '@/lib/prisma';
import { lockForUpdate } from '@/lib/api/race-guard';
import { StockMovementReason } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import {
  planPurchaseOrderSubtotalRepair,
  planReceiptMovementRepair,
  type PurchaseOrderSubtotalRepairPlan,
  type ReceiptMovementRepairPlan,
} from '@/lib/services/purchaseOrderRepair.core';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const tenantId =
  argv.find((arg) => arg.startsWith('--tenant='))?.slice('--tenant='.length).trim() || undefined;
const poId =
  argv.find((arg) => arg.startsWith('--po='))?.slice('--po='.length).trim() || undefined;

const SCRIPT = 'scripts/repair-purchase-orders.ts';

const PO_SELECT = {
  id: true,
  tenantId: true,
  referenceNo: true,
  subtotalAmount: true,
  discountAmount: true,
  totalAmount: true,
  lines: {
    select: {
      id: true,
      variantId: true,
      orderedQty: true,
      expectedCostPrice: true,
      receivedQty: true,
      variant: { select: { sku: true, stockQuantity: true } },
    },
  },
} as const;

type PurchaseOrderRow = Prisma.PurchaseOrderGetPayload<{ select: typeof PO_SELECT }>;

type LineRow = PurchaseOrderRow['lines'][number];

interface Candidate {
  po: PurchaseOrderRow;
  subtotal: PurchaseOrderSubtotalRepairPlan;
  receipts: Array<{ line: LineRow; plan: ReceiptMovementRepairPlan }>;
}

function needsAttention(candidate: Candidate): boolean {
  return (
    candidate.subtotal.status !== 'ok' ||
    candidate.receipts.some(
      (receipt) => receipt.plan.status === 'create' || receipt.plan.status === 'manual',
    )
  );
}

async function planReceipt(line: LineRow, po: { id: string; tenantId: string }) {
  const [existing, tail] = await Promise.all([
    prisma.stockMovement.findFirst({
      where: {
        tenantId: po.tenantId,
        purchaseOrderId: po.id,
        variantId: line.variantId,
        reason: StockMovementReason.PURCHASE_RECEIVED,
      },
      select: { id: true },
    }),
    prisma.stockMovement.findFirst({
      where: { tenantId: po.tenantId, variantId: line.variantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { quantityAfter: true },
    }),
  ]);

  return planReceiptMovementRepair({
    receivedQty: line.receivedQty,
    hasReceiptMovement: existing !== null,
    ledgerTail: tail?.quantityAfter ?? null,
    currentStock: line.variant.stockQuantity,
  });
}

async function collectCandidates(): Promise<Candidate[]> {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(poId !== undefined ? { id: poId } : {}),
    },
    select: PO_SELECT,
    orderBy: [{ tenantId: 'asc' }, { referenceNo: 'asc' }],
  });

  const candidates: Candidate[] = [];

  for (const po of purchaseOrders) {
    const subtotal = planPurchaseOrderSubtotalRepair(po, po.lines);
    const receipts: Candidate['receipts'] = [];
    for (const line of po.lines) {
      receipts.push({ line, plan: await planReceipt(line, po) });
    }

    const candidate = { po, subtotal, receipts };
    if (needsAttention(candidate)) candidates.push(candidate);
  }

  return candidates;
}

type ApplyOutcome =
  | { status: 'applied'; notes: string[] }
  | { status: 'noop' }
  | { status: 'manual'; reasons: string[] }
  | { status: 'failed'; reason: string };

async function applyCandidate(candidate: Candidate): Promise<ApplyOutcome> {
  const { po } = candidate;

  try {
    return await prisma.$transaction(async (tx) => {
      await lockForUpdate(tx, 'purchase_orders', '"id" = $1 AND "tenantId" = $2', [
        po.id,
        po.tenantId,
      ]);

      const fresh = await tx.purchaseOrder.findFirst({
        where: { id: po.id, tenantId: po.tenantId },
        select: PO_SELECT,
      });
      if (!fresh) {
        return { status: 'manual', reasons: ['purchase order no longer exists'] };
      }

      const notes: string[] = [];
      const manual: string[] = [];
      const movements: Array<{
        variantId: string;
        sku: string;
        quantityDelta: number;
        quantityBefore: number;
        quantityAfter: number;
      }> = [];
      let wrote = false;

      const subtotalPlan = planPurchaseOrderSubtotalRepair(fresh, fresh.lines);
      if (subtotalPlan.status === 'repair') {
        await tx.purchaseOrder.update({
          where: { id: fresh.id },
          data: { subtotalAmount: subtotalPlan.subtotal },
        });
        notes.push(
          `subtotal ${subtotalPlan.previousSubtotal.toFixed(2)} -> ${subtotalPlan.subtotal.toFixed(2)}`,
        );
        wrote = true;
      } else if (subtotalPlan.status === 'manual') {
        manual.push(subtotalPlan.reason);
      }

      for (const line of fresh.lines) {
        if (line.receivedQty <= 0) continue;

        // Serialise against stock writes so the gap below cannot change between
        // the read and the append.
        await lockForUpdate(tx, 'product_variants', '"id" = $1 AND "tenantId" = $2', [
          line.variantId,
          po.tenantId,
        ]);

        const variant = await tx.productVariant.findFirst({
          where: { id: line.variantId, tenantId: po.tenantId },
          select: { stockQuantity: true },
        });
        const [existing, tail] = await Promise.all([
          tx.stockMovement.findFirst({
            where: {
              tenantId: po.tenantId,
              purchaseOrderId: po.id,
              variantId: line.variantId,
              reason: StockMovementReason.PURCHASE_RECEIVED,
            },
            select: { id: true },
          }),
          tx.stockMovement.findFirst({
            where: { tenantId: po.tenantId, variantId: line.variantId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { quantityAfter: true },
          }),
        ]);

        const plan = planReceiptMovementRepair({
          receivedQty: line.receivedQty,
          hasReceiptMovement: existing !== null,
          ledgerTail: tail?.quantityAfter ?? null,
          currentStock: variant?.stockQuantity ?? line.variant.stockQuantity,
        });

        if (plan.status === 'create') {
          await tx.stockMovement.create({
            data: {
              tenantId: po.tenantId,
              variantId: line.variantId,
              reason: StockMovementReason.PURCHASE_RECEIVED,
              quantityDelta: plan.quantityDelta,
              quantityBefore: plan.quantityBefore,
              quantityAfter: plan.quantityAfter,
              actorId: null,
              note:
                `Reconstructed receipt movement for already-received PO ${fresh.referenceNo} ` +
                `(ARGUS #232, ${SCRIPT}). Stock already reflected the receipt; no quantity was changed.`,
              purchaseOrderId: fresh.id,
            },
          });
          movements.push({
            variantId: line.variantId,
            sku: line.variant.sku,
            quantityDelta: plan.quantityDelta,
            quantityBefore: plan.quantityBefore,
            quantityAfter: plan.quantityAfter,
          });
          notes.push(
            `${line.variant.sku} +${plan.quantityDelta} (${plan.quantityBefore} -> ${plan.quantityAfter})`,
          );
          wrote = true;
        } else if (plan.status === 'manual') {
          manual.push(`${line.variant.sku}: ${plan.reason}`);
        }
      }

      if (wrote) {
        await tx.auditLog.create({
          data: {
            tenantId: po.tenantId,
            actorId: null,
            actorRole: 'SYSTEM',
            entityType: 'PurchaseOrder',
            entityId: fresh.id,
            action: 'PURCHASE_ORDER_REPAIRED',
            before: {
              referenceNo: fresh.referenceNo,
              subtotalAmount: fresh.subtotalAmount.toString(),
              totalAmount: fresh.totalAmount.toString(),
            },
            after: {
              referenceNo: fresh.referenceNo,
              subtotalAmount: String(
                subtotalPlan.status === 'repair' ? subtotalPlan.subtotal : fresh.subtotalAmount,
              ),
              reconstructedMovements: movements,
              script: SCRIPT,
            },
          },
        });
      }

      if (manual.length > 0) {
        return wrote
          ? { status: 'manual', reasons: [...notes, 'MANUAL: ...', ...manual] }
          : { status: 'manual', reasons: manual };
      }
      return wrote ? { status: 'applied', notes } : { status: 'noop' };
    });
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

function describeCandidate(candidate: Candidate): string[] {
  const lines: string[] = [];
  const { po, subtotal, receipts } = candidate;

  if (subtotal.status === 'repair') {
    lines.push(
      `subtotal ${subtotal.previousSubtotal.toFixed(2)} -> ${subtotal.subtotal.toFixed(2)}`,
    );
  } else if (subtotal.status === 'manual') {
    lines.push(`subtotal MANUAL - ${subtotal.reason}`);
  }

  for (const { line, plan } of receipts) {
    if (plan.status === 'create') {
      lines.push(
        `${line.variant.sku} +${plan.quantityDelta} (${plan.quantityBefore} -> ${plan.quantityAfter})`,
      );
    } else if (plan.status === 'manual') {
      lines.push(`${line.variant.sku} MANUAL - ${plan.reason}`);
    }
  }

  return lines.length > 0 ? lines : ['nothing to do'];
}

async function main(): Promise<void> {
  const candidates = await collectCandidates();

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'}: ${candidates.length} purchase order(s) needing repair` +
      `${tenantId ? ` (tenant ${tenantId})` : ''}${poId ? ` (PO ${poId})` : ''}.`,
  );
  console.log('Stock is never adjusted; only subtotalAmount and missing receipt rows can change.');
  console.log('');

  if (candidates.length === 0) {
    console.log('Nothing to repair. No rows were written.');
    return;
  }

  for (const candidate of candidates) {
    console.log(`${candidate.po.referenceNo}  tenant=${candidate.po.tenantId}`);
    for (const detail of describeCandidate(candidate)) {
      console.log(`  ${detail}`);
    }
  }
  console.log('');

  if (!apply) {
    console.log('Dry run only - no rows were changed. Re-run with --apply to write the safe repairs.');
    return;
  }

  let applied = 0;
  let noop = 0;
  let manual = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const outcome = await applyCandidate(candidate);
    switch (outcome.status) {
      case 'applied':
        applied += 1;
        console.log(`APPLIED ${candidate.po.referenceNo}`);
        for (const note of outcome.notes) console.log(`  ${note}`);
        break;
      case 'noop':
        noop += 1;
        console.log(`SKIPPED ${candidate.po.referenceNo} - already repaired by a concurrent change.`);
        break;
      case 'manual':
        manual += 1;
        console.log(`MANUAL ${candidate.po.referenceNo}`);
        for (const reason of outcome.reasons) console.log(`  ${reason}`);
        break;
      case 'failed':
        failed += 1;
        console.log(`FAILED ${candidate.po.referenceNo} - ${outcome.reason}`);
        break;
    }
  }

  console.log('');
  console.log(
    `Done: ${applied} applied, ${noop} already reconciled, ${manual} manual, ${failed} failed.`,
  );

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Purchase-order repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
