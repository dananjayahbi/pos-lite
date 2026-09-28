import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import { POStatus, StockMovementReason } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import { adjustStockInTx } from '@/lib/services/inventory.service';
import { lockForUpdate } from '@/lib/api/race-guard';
// ── Private Helpers ──────────────────────────────────────────────────────────

function buildVariantDescription(variant: {
  form?: string | null;
  packSize?: string | null;
}): string {
  const parts: string[] = [];
  if (variant.form) parts.push(variant.form);
  if (variant.packSize) parts.push(variant.packSize);
  return parts.length > 0 ? parts.join(' / ') : 'Default';
}

const VALID_TRANSITIONS: Record<string, POStatus[]> = {
  [POStatus.DRAFT]: [POStatus.SENT, POStatus.CANCELLED],
  [POStatus.SENT]: [POStatus.CANCELLED],
};

// ── Create PO ────────────────────────────────────────────────────────────────

interface CreatePOLineInput {
  variantId: string;
  orderedQty: number;
  expectedCostPrice: number | string;
}

interface CreatePOInput {
  supplierId: string;
  lines: CreatePOLineInput[];
  expectedDeliveryDate?: string | undefined;
  notes?: string | undefined;
}

export async function createPO(tenantId: string, createdById: string, input: CreatePOInput) {
  if (input.lines.length === 0) {
    throw new Error('At least one line is required');
  }

  // Verify supplier ownership
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, tenantId, isActive: true },
  });
  if (!supplier) {
    throw new Error('Supplier not found');
  }

  // Fetch all variants with their products
  const variantIds = input.lines.map((l) => l.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, tenantId },
    include: { product: { select: { name: true } } },
  });

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Build lines data and compute total
  let totalAmount = new Decimal(0);
  const linesData = input.lines.map((line) => {
    const variant = variantMap.get(line.variantId);
    if (!variant) {
      throw new Error(`Variant not found: ${line.variantId}`);
    }
    const cost = new Decimal(line.expectedCostPrice);
    totalAmount = totalAmount.plus(cost.times(line.orderedQty));

    return {
      variantId: line.variantId,
      orderedQty: line.orderedQty,
      expectedCostPrice: cost.toDecimalPlaces(2).toNumber(),
      productNameSnapshot: variant.product.name,
      variantDescriptionSnapshot: buildVariantDescription(variant),
    };
  });

  return prisma.purchaseOrder.create({
    data: {
      tenantId,
      supplierId: input.supplierId,
      createdById,
      totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
      ...(input.expectedDeliveryDate !== undefined && {
        expectedDeliveryDate: new Date(input.expectedDeliveryDate),
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      lines: {
        create: linesData,
      },
    },
    include: {
      lines: true,
      supplier: true,
    },
  });
}

// ── Get PO by ID ─────────────────────────────────────────────────────────────

export async function getPOById(tenantId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    include: {
      supplier: true,
      tenant: { select: { name: true } },
      createdBy: { select: { id: true, email: true } },
      lines: {
        include: {
          variant: {
            select: {
              sku: true,
              form: true,
              packSize: true,
              costPrice: true,
              stockQuantity: true,
              imageUrls: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  return po;
}

// ── List POs ─────────────────────────────────────────────────────────────────

interface GetPOsOptions {
  supplierId?: string | undefined;
  status?: POStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export async function getPOs(tenantId: string, options: GetPOsOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };

  if (options.supplierId !== undefined) {
    where.supplierId = options.supplierId;
  }
  if (options.status !== undefined) {
    where.status = options.status;
  }
  if (options.from !== undefined || options.to !== undefined) {
    const createdAt: Record<string, Date> = {};
    if (options.from !== undefined) createdAt.gte = new Date(options.from);
    if (options.to !== undefined) createdAt.lte = new Date(options.to + 'T23:59:59.999Z');
    where.createdAt = createdAt;
  }

  const [purchaseOrders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    purchaseOrders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Update PO Status ─────────────────────────────────────────────────────────

export async function updatePOStatus(tenantId: string, poId: string, newStatus: POStatus) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  const allowed = VALID_TRANSITIONS[po.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${po.status} to ${newStatus}`);
  }

  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: newStatus },
  });
}

// ── Cancel PO ────────────────────────────────────────────────────────────────

export async function cancelPO(tenantId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  if (po.status !== POStatus.DRAFT && po.status !== POStatus.SENT) {
    throw new Error(`Cannot cancel a purchase order with status ${po.status}`);
  }

  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: POStatus.CANCELLED },
  });
}

// ── Receive PO Lines ─────────────────────────────────────────────────────────

interface ReceiveLineInput {
  lineId: string;
  receivedQty: number;
  actualCostPrice?: number | string | undefined;
  /** Optional batch number captured at goods receipt (doc 29). */
  batchNumber?: string | undefined;
  /** Optional expiry date captured at goods receipt (doc 29). */
  expiryDate?: string | undefined;
}

interface ReceivePOLinesInput {
  receivedLines: ReceiveLineInput[];
}

/**
 * M16-01 (BUG-48) — receive goods against a PO with an exactly-once contract.
 *
 * The check-then-write over-receipt guard used to read `line.receivedQty` from
 * the transaction's snapshot; two concurrent full receipts could both read `0`
 * and both report success (final quantity was correct, but one caller got a
 * success it could not distinguish from the committed one).
 *
 * Fix shape (XC-06 read-modify-write family): lock every requested
 * `PurchaseOrderLine` row with `SELECT ... FOR UPDATE` (sorted by id — stable
 * order, no deadlock) BEFORE the pre-check, then re-read the committed
 * `receivedQty`. The second receipt blocks, re-reads the committed value and,
 * if it now breaches `orderedQty`, fails with the typed `OVER_RECEIPT`
 * sentinel → 409 (the request in itself was valid, the row simply moved).
 * A static payload that already breaches `orderedQty` keeps its long-standing
 * `would exceed ordered qty` prose → 400.
 */
export async function receivePOLines(
  tenantId: string,
  poId: string,
  input: ReceivePOLinesInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
      include: { lines: true },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    const lineMap = new Map(po.lines.map((l) => [l.id, l]));
    const costPricesChanged: Array<{
      variantId: string;
      oldCostPrice: string;
      newCostPrice: string;
    }> = [];

    // ─ M16-01 (BUG-48): serialize concurrent receipts of the same lines.
    // Lock every requested row with SELECT ... FOR UPDATE (sorted by id — a
    // stable order, so two overlapping multi-line receipts can never deadlock)
    // and then re-read the *committed* quantities. The old code compared
    // against the transaction-start snapshot, which let two concurrent full
    // receipts both read 0 and both report success. Only ids that actually
    // belong to this PO are locked, so a hostile payload cannot lock foreign
    // rows; unknown ids still fail the per-line check below.
    const requestedLineIds = Array.from(
      new Set(input.receivedLines.map((l) => l.lineId)),
    )
      .filter((lineId) => lineMap.has(lineId))
      .sort();
    for (const lineId of requestedLineIds) {
      await lockForUpdate(tx, 'purchase_order_lines', '"id" = $1', [lineId]);
    }
    const committedReceivedQty = new Map<string, number>();
    if (requestedLineIds.length > 0) {
      const lockedLines = await tx.purchaseOrderLine.findMany({
        where: { id: { in: requestedLineIds } },
        select: { id: true, receivedQty: true },
      });
      for (const locked of lockedLines) {
        committedReceivedQty.set(locked.id, locked.receivedQty);
      }
    }
    /** Post-lock quantity: the committed value when the row exists, else the snapshot. */
    const alreadyReceivedOf = (lineId: string): number =>
      committedReceivedQty.get(lineId) ?? lineMap.get(lineId)?.receivedQty ?? 0;

    if (po.status === POStatus.CANCELLED) {
      throw new Error(`Cannot receive goods for a ${po.status} purchase order`);
    }

    if (po.status === POStatus.RECEIVED) {
      // A concurrent receipt already closed this PO (its commit landed before
      // this transaction's first read). When the payload adds nothing new —
      // every requested line is already at/over its ordered qty — this is a
      // duplicate replay of the same receipt, so it gets the typed 409 rather
      // than the workflow-boundary 400.
      const isDuplicateReplay =
        input.receivedLines.length > 0 &&
        input.receivedLines.every((received) => {
          const line = lineMap.get(received.lineId);
          if (!line) return false;
          return alreadyReceivedOf(line.id) + received.receivedQty > line.orderedQty;
        });
      if (isDuplicateReplay) {
        throw new Error(
          `OVER_RECEIPT: purchase order ${poId} was already fully received by another receipt`,
        );
      }
      throw new Error(`Cannot receive goods for a ${po.status} purchase order`);
    }

    for (const received of input.receivedLines) {
      const line = lineMap.get(received.lineId);
      if (!line) {
        throw new Error(`Line ${received.lineId} not found in this purchase order`);
      }

      if (received.receivedQty <= 0) {
        throw new Error('Received quantity must be greater than 0');
      }

      // The locked re-read is authoritative; `line.receivedQty` is only the
      // transaction-start snapshot (kept for the 400 prose branch below).
      const alreadyReceived = alreadyReceivedOf(line.id);
      const totalReceived = alreadyReceived + received.receivedQty;
      if (totalReceived > line.orderedQty) {
        if (alreadyReceived !== line.receivedQty) {
          // Another receipt committed while this one waited on the row lock —
          // this caller lost the race. Typed sentinel → 409 (INF-02).
          throw new Error(
            `OVER_RECEIPT: line ${line.id} would exceed ordered qty (${line.orderedQty}, already received ${alreadyReceived})`,
          );
        }
        throw new Error(
          `Cannot receive ${received.receivedQty} for line ${received.lineId}: would exceed ordered qty (${line.orderedQty}, already received ${alreadyReceived})`,
        );
      }

      // Capture / accumulate batch record when a batch number is supplied.
      let batchId: string | undefined;
      if (received.batchNumber) {
        const existing = await tx.batchTracking.findFirst({
          where: { tenantId, variantId: line.variantId, batchNumber: received.batchNumber },
        });
        if (existing) {
          await tx.batchTracking.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + received.receivedQty },
          });
          batchId = existing.id;
        } else {
          const created = await tx.batchTracking.create({
            data: {
              tenantId,
              variantId: line.variantId,
              batchNumber: received.batchNumber,
              expiryDate: received.expiryDate ? new Date(received.expiryDate) : null,
              quantity: received.receivedQty,
              source: 'PURCHASE',
            },
          });
          batchId = created.id;
        }
      }

      // Adjust stock
      await adjustStockInTx(tx, tenantId, line.variantId, actorId, {
        quantityDelta: received.receivedQty,
        reason: StockMovementReason.PURCHASE_RECEIVED,
        purchaseOrderId: poId,
        batchId,
      });

      // Update line
      const isFullyReceived = totalReceived === line.orderedQty;
      const updateData: Record<string, unknown> = {
        receivedQty: totalReceived,
        isFullyReceived,
      };
      if (received.actualCostPrice !== undefined) {
        updateData.actualCostPrice = new Decimal(received.actualCostPrice)
          .toDecimalPlaces(2)
          .toNumber();
      }
      if (received.batchNumber !== undefined) {
        updateData.receivedBatchNumber = received.batchNumber;
      }
      if (received.expiryDate !== undefined) {
        updateData.receivedExpiryDate = new Date(received.expiryDate);
      }

      await tx.purchaseOrderLine.update({
        where: { id: received.lineId },
        data: updateData,
      });

      // Update variant cost price if actual differs
      if (received.actualCostPrice !== undefined) {
        const actualCost = new Decimal(received.actualCostPrice);
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          select: { costPrice: true },
        });
        if (variant) {
          const currentCost = new Decimal(variant.costPrice.toString());
          if (!actualCost.equals(currentCost)) {
            await tx.productVariant.update({
              where: { id: line.variantId },
              data: { costPrice: actualCost.toDecimalPlaces(2).toNumber() },
            });
            costPricesChanged.push({
              variantId: line.variantId,
              oldCostPrice: currentCost.toFixed(2),
              newCostPrice: actualCost.toFixed(2),
            });
          }
        }
      }
    }

    // Determine new PO status
    const updatedLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: poId },
    });

    const allFullyReceived = updatedLines.every((l) => l.isFullyReceived);
    const anyReceived = updatedLines.some((l) => l.receivedQty > 0);

    let newStatus: POStatus = po.status;
    if (allFullyReceived) {
      newStatus = POStatus.RECEIVED;
    } else if (anyReceived) {
      newStatus = POStatus.PARTIALLY_RECEIVED;
    }

    const updatedPO = await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus },
      include: {
        lines: true,
        supplier: true,
      },
    });

    return {
      updatedPO,
      costPricesChanged,
      costPriceChangedCount: costPricesChanged.length,
    };
  }, { timeout: 30000 });
}

// ── Format PO for WhatsApp ───────────────────────────────────────────────────

export function formatPOForWhatsApp(po: Awaited<ReturnType<typeof getPOById>>): string {
  const sep = '──────────────────────';
  const storeName = (po.tenant?.name ?? 'AyurPOS Store').toUpperCase();
  const poRef = `PO-${po.id.slice(-8).toUpperCase()}`;
  const deliveryDate = po.expectedDeliveryDate
    ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Not specified';

  const lines = po.lines.map((line, i) => {
    const name = line.productNameSnapshot;
    const desc = line.variantDescriptionSnapshot;
    const label = desc !== 'Default' ? `${name} - ${desc}` : name;
    const cost = new Decimal(line.expectedCostPrice.toString()).toFixed(2);
    return `${i + 1}. ${label} | Qty: ${line.orderedQty} | Cost: Rs. ${cost}`;
  });

  const total = new Decimal(po.totalAmount.toString()).toFixed(2);

  return [
    storeName,
    sep,
    `PURCHASE ORDER ${poRef}`,
    `Supplier: ${po.supplier.name}`,
    `Expected Delivery: ${deliveryDate}`,
    sep,
    ...lines,
    sep,
    `TOTAL: Rs. ${total}`,
    '',
    'This order was generated by AyurPOS.',
    'Please confirm receipt by replying.',
  ].join('\n');
}
