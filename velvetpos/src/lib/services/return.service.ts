import { prisma } from '@/lib/prisma';
import { ReturnRefundMethod, ReturnStatus } from '@/generated/prisma/client';
import { adjustStockInTx, type TxClient } from '@/lib/services/inventory.service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { kickCashDrawer } from '@/lib/hardware/cashDrawer';
import type { PrinterConfig } from '@/lib/hardware/printer';
import Decimal from 'decimal.js';

const RETURN_WINDOW_DAYS = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getRemainingReturnableQty(
  saleLineId: string,
  tx: TxClient,
): Promise<number> {
  const result = await tx.returnLine.aggregate({
    where: {
      originalSaleLineId: saleLineId,
      return: { status: ReturnStatus.COMPLETED },
    },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

// ── Validation ───────────────────────────────────────────────────────────────

interface ReturnLineInput {
  saleLineId: string;
  variantId: string;
  quantity: number;
}

export async function validateReturnEligibility(
  tenantId: string,
  originalSaleId: string,
  lines: ReturnLineInput[],
  tx: TxClient,
) {
  const sale = await tx.sale.findUnique({
    where: { id: originalSaleId },
    include: { lines: true },
  });

  if (!sale) {
    throw new Error(`Sale not found: ${originalSaleId}`);
  }

  if (sale.tenantId !== tenantId) {
    throw new Error('Authorization error: sale does not belong to this tenant');
  }

  if (sale.status !== 'COMPLETED') {
    throw new Error(`Sale status must be COMPLETED for return. Current status: ${sale.status}`);
  }

  // Check return window
  const saleDate = new Date(sale.createdAt);
  const expiryDate = new Date(saleDate);
  expiryDate.setDate(expiryDate.getDate() + RETURN_WINDOW_DAYS);
  const now = new Date();

  if (now > expiryDate) {
    throw new Error(
      `Return window expired. Sale date: ${saleDate.toISOString().slice(0, 10)}, ` +
        `expiry: ${expiryDate.toISOString().slice(0, 10)}`,
    );
  }

  // Validate each line
  for (const line of lines) {
    const saleLine = sale.lines.find((sl) => sl.id === line.saleLineId);
    if (!saleLine) {
      throw new Error(`Sale line ${line.saleLineId} does not belong to sale ${originalSaleId}`);
    }

    if (line.quantity <= 0) {
      throw new Error(`Return quantity must be greater than zero for line ${line.saleLineId}`);
    }

    const alreadyReturned = await getRemainingReturnableQty(line.saleLineId, tx);
    const remaining = saleLine.quantity - alreadyReturned;

    if (line.quantity > remaining) {
      throw new Error(
        `Cannot return ${line.quantity} units of variant ${line.variantId} ` +
          `(line ${line.saleLineId}). Only ${remaining} units remaining ` +
          `(original: ${saleLine.quantity}, already returned: ${alreadyReturned})`,
      );
    }
  }

  return sale;
}

// ── Refund Computation ───────────────────────────────────────────────────────

interface ComputedReturnLine {
  saleLineId: string;
  variantId: string;
  quantity: number;
  unitPrice: Decimal;
  lineRefundAmount: Decimal;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
}

export function computeLineRefundAmounts(
  sale: { lines: Array<{ id: string; variantId: string; quantity: number; unitPrice: Decimal | { toString(): string }; lineTotalAfterDiscount: Decimal | { toString(): string }; productNameSnapshot: string; variantDescriptionSnapshot: string }> },
  requestLines: ReturnLineInput[],
): { lines: ComputedReturnLine[]; totalRefund: Decimal } {
  const computed: ComputedReturnLine[] = [];
  let totalRefund = new Decimal(0);

  for (const req of requestLines) {
    const saleLine = sale.lines.find((sl) => sl.id === req.saleLineId)!;
    const lineTotalAfterDiscount = new Decimal(saleLine.lineTotalAfterDiscount.toString());
    const originalQty = new Decimal(saleLine.quantity);
    const returnQty = new Decimal(req.quantity);
    const unitPrice = new Decimal(saleLine.unitPrice.toString());

    const lineRefundAmount = returnQty
      .div(originalQty)
      .mul(lineTotalAfterDiscount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    totalRefund = totalRefund.plus(lineRefundAmount);

    computed.push({
      saleLineId: req.saleLineId,
      variantId: req.variantId,
      quantity: req.quantity,
      unitPrice,
      lineRefundAmount,
      productNameSnapshot: saleLine.productNameSnapshot,
      variantDescriptionSnapshot: saleLine.variantDescriptionSnapshot,
    });
  }

  return { lines: computed, totalRefund };
}

// ── Initiate Return ──────────────────────────────────────────────────────────

interface InitiateReturnInput {
  initiatedById: string;
  authorizedById: string;
  originalSaleId: string;
  lines: ReturnLineInput[];
  refundMethod: ReturnRefundMethod;
  restockItems: boolean;
  reason: string;
}

export async function initiateReturn(tenantId: string, input: InitiateReturnInput) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Validate
    const sale = await validateReturnEligibility(
      tenantId,
      input.originalSaleId,
      input.lines,
      tx,
    );

    // 2. Compute refunds
    const { lines: computedLines, totalRefund } = computeLineRefundAmounts(sale, input.lines);

    // 3. Create Return record
    const returnRecord = await tx.return.create({
      data: {
        tenantId,
        originalSaleId: input.originalSaleId,
        initiatedById: input.initiatedById,
        authorizedById: input.authorizedById,
        refundMethod: input.refundMethod,
        refundAmount: totalRefund.toFixed(2),
        restockItems: input.restockItems,
        reason: input.reason,
        status: ReturnStatus.COMPLETED,
      },
    });

    // 4. Create ReturnLine records
    await tx.returnLine.createMany({
      data: computedLines.map((cl) => ({
        returnId: returnRecord.id,
        originalSaleLineId: cl.saleLineId,
        variantId: cl.variantId,
        productNameSnapshot: cl.productNameSnapshot,
        variantDescriptionSnapshot: cl.variantDescriptionSnapshot,
        quantity: cl.quantity,
        unitPrice: cl.unitPrice.toFixed(2),
        lineRefundAmount: cl.lineRefundAmount.toFixed(2),
        isRestocked: false,
      })),
    });

    // 5. Restock if enabled
    if (input.restockItems) {
      for (const cl of computedLines) {
        await adjustStockInTx(tx, tenantId, cl.variantId, input.initiatedById, {
          quantityDelta: cl.quantity,
          reason: 'SALE_RETURN',
          note: `Return ref ${returnRecord.id}`,
        });

        // Mark line as restocked — find by returnId + saleLineId
        await tx.returnLine.updateMany({
          where: {
            returnId: returnRecord.id,
            originalSaleLineId: cl.saleLineId,
          },
          data: { isRestocked: true },
        });
      }
    }

    // 6. Create StoreCredit if applicable
    if (input.refundMethod === ReturnRefundMethod.STORE_CREDIT) {
      await tx.storeCredit.create({
        data: {
          tenantId,
          amount: totalRefund.toFixed(2),
          note: `Return ref ${returnRecord.id}`,
        },
      });
    }

    // 7. Return fully loaded record
    return tx.return.findUniqueOrThrow({
      where: { id: returnRecord.id },
      include: {
        lines: true,
        originalSale: true,
        initiatedBy: true,
        authorizedBy: true,
      },
    });
  });

  void createAuditLog({
    tenantId,
    actorId: input.initiatedById,
    actorRole: 'USER',
    entityType: 'Return',
    entityId: result.id,
    action: AUDIT_ACTIONS.RETURN_COMPLETED,
    after: { originalSaleId: input.originalSaleId, refundAmount: result.refundAmount, refundMethod: input.refundMethod, lineCount: result.lines.length },
  }).catch(() => {});

  // Kick cash drawer for cash refunds (fire-and-forget)
  if (input.refundMethod === ReturnRefundMethod.CASH) {
    void prisma.tenant
      .findUnique({ where: { id: tenantId }, select: { settings: true } })
      .then((tenant) => {
        if (!tenant) return;
        const hw = (tenant.settings as any)?.hardware?.printer;
        if (!hw?.host) return;
        const printerConfig: PrinterConfig = {
          type: hw.type ?? 'NETWORK',
          host: hw.host,
          port: hw.port,
          paperWidth: hw.paperWidth ?? '58mm',
        };
        void kickCashDrawer(printerConfig);
      })
      .catch(() => {});
  }

  return result;
}

// ── Get Return By ID ─────────────────────────────────────────────────────────

export async function getReturnById(tenantId: string, returnId: string) {
  const record = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      lines: true,
      originalSale: true,
      initiatedBy: true,
      authorizedBy: true,
    },
  });

  if (!record || record.tenantId !== tenantId) {
    throw new Error(`Return not found: ${returnId}`);
  }

  return record;
}

// ── Get Returns (Paginated) ──────────────────────────────────────────────────

interface GetReturnsFilters {
  originalSaleId?: string | undefined;
  initiatedById?: string | undefined;
  refundMethod?: ReturnRefundMethod | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export async function getReturns(tenantId: string, filters: GetReturnsFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };

  if (filters.originalSaleId !== undefined) {
    where.originalSaleId = filters.originalSaleId;
  }
  if (filters.initiatedById !== undefined) {
    where.initiatedById = filters.initiatedById;
  }
  if (filters.refundMethod !== undefined) {
    where.refundMethod = filters.refundMethod;
  }
  if (filters.from !== undefined || filters.to !== undefined) {
    const createdAt: Record<string, Date> = {};
    if (filters.from !== undefined) createdAt.gte = filters.from;
    if (filters.to !== undefined) createdAt.lte = filters.to;
    where.createdAt = createdAt;
  }

  const [data, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: {
        lines: true,
        originalSale: true,
        initiatedBy: true,
        authorizedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.return.count({ where }),
  ]);

  return { data, total };
}
