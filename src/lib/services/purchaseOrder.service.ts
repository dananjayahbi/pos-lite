import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import { POStatus, StockMovementReason } from '@/generated/prisma/client';
import { adjustStockInTx, type TxClient } from '@/lib/services/inventory.service';

// ── Private Helpers ──────────────────────────────────────────────────────────

function buildVariantDescription(variant: {
  size?: string | null;
  colour?: string | null;
}): string {
  const parts: string[] = [];
  if (variant.size) parts.push(variant.size);
  if (variant.colour) parts.push(variant.colour);
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
              size: true,
              colour: true,
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
}

interface ReceivePOLinesInput {
  receivedLines: ReceiveLineInput[];
}

export async function receivePOLines(
  tenantId: string,
  poId: string,
  input: ReceivePOLinesInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx: TxClient) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
      include: { lines: true },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    if (po.status === POStatus.CANCELLED || po.status === POStatus.RECEIVED) {
      throw new Error(`Cannot receive goods for a ${po.status} purchase order`);
    }

    const lineMap = new Map(po.lines.map((l) => [l.id, l]));
    const costPricesChanged: Array<{
      variantId: string;
      oldCostPrice: string;
      newCostPrice: string;
    }> = [];

    for (const received of input.receivedLines) {
      const line = lineMap.get(received.lineId);
      if (!line) {
        throw new Error(`Line ${received.lineId} not found in this purchase order`);
      }

      if (received.receivedQty <= 0) {
        throw new Error('Received quantity must be greater than 0');
      }

      const totalReceived = line.receivedQty + received.receivedQty;
      if (totalReceived > line.orderedQty) {
        throw new Error(
          `Cannot receive ${received.receivedQty} for line ${received.lineId}: would exceed ordered qty (${line.orderedQty}, already received ${line.receivedQty})`,
        );
      }

      // Adjust stock
      await adjustStockInTx(tx, tenantId, line.variantId, actorId, {
        quantityDelta: received.receivedQty,
        reason: StockMovementReason.PURCHASE_RECEIVED,
        purchaseOrderId: poId,
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
  const storeName = (po.tenant?.name ?? 'VelvetPOS Store').toUpperCase();
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
    'This order was generated by VelvetPOS.',
    'Please confirm receipt by replying.',
  ].join('\n');
}
