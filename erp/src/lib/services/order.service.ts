import 'server-only';

import { Prisma, OrderPaymentMethod, OrderPaymentStatus } from '@/generated/prisma/client';
import type { StockMovementReason } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { estimateWebsiteShippingFee } from '@/lib/services/shipping-fee.service';
import type {
  BulkStatusChangeInput,
  BulkCreateDeliveryInput,
  BulkResultItem,
} from '@/lib/validators/order.validators';
import type { WebsiteCheckoutInput } from '@/lib/validators/checkout.validators';
import type { DeliveryStatus } from '@/generated/prisma/client';

/** Statuses from which an order may be advanced into the dispatch pipeline. */
const PRE_DISPATCH_STATUSES = ['PLACED', 'HOLD', 'PENDING_DISPATCH'] as const;

function isPreDispatch(status: string): boolean {
  return (PRE_DISPATCH_STATUSES as readonly string[]).includes(status);
}

/**
 * M28-02/BUG-98: allocate the next order reference for a tenant+year from the
 * `OrderRefCounter` row with an atomic increment. Must run inside the order
 * transaction so concurrent checkouts serialize (the unique constraint on
 * `Delivery([tenantId, orderRef])` is the hard backstop).
 */
async function allocateOrderRef(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await tx.orderRefCounter.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  // 6 digits keeps the format unambiguous well past 10k orders/year.
  return `ORD-${year}-${String(counter.lastSeq).padStart(6, '0')}`;
}

/** Thrown when a requested variant/quantity cannot be reserved. */
export class OutOfStockError extends Error {
  constructor(message = 'OUT_OF_STOCK') {
    // Keep the sentinel as the message so INF-02 / route mapping can match it.
    super(message);
    this.name = 'OutOfStockError';
  }
}

/**
 * Create a website order as a `Delivery` (source WEBSITE_CHECKOUT, status
 * PLACED) with a shipping-address snapshot. Used by the public checkout
 * endpoint so online orders appear immediately in the ERP Orders page.
 */
export async function createWebsiteOrder(
  tenantId: string,
  input: WebsiteCheckoutInput,
): Promise<{ deliveryId: string; orderRef: string; shippingFee: string | null }> {
  setSentryTenantContext({ tenantId });

  // Default COD (unpaid-by-design). CARD orders start PENDING and are marked
  // PAID once the gateway confirms via IPN.
  const paymentMethod =
    input.paymentMethod === 'CARD' ? OrderPaymentMethod.CARD : OrderPaymentMethod.COD;
  const paymentStatus = OrderPaymentStatus.PENDING;

  // Price the delivery from the active rate card (single source of truth).
  // The website sends free-text city/district names + an optional total weight;
  // this resolves names to numeric ids and computes the fee that will be stored
  // on the Delivery and echoed back to the checkout for confirmation.
  const shipping = await estimateWebsiteShippingFee({
    tenantId,
    weightKg: input.totalWeightKg,
    cityName: input.cityName,
    districtName: input.districtName ?? undefined,
  });

  const requestedLines = input.lines ?? [];

  const delivery = await prisma.$transaction(
    async (tx) => {
      const orderRef = await allocateOrderRef(tx, tenantId);

      // M28-01/BUG-97: the checkout never read `input.lines` and stored whatever
      // totals the browser sent — guaranteed overselling and unpriceable orders.
      // Resolve every line server-side (tenant-scoped, live, in stock), compute
      // the totals from the DB prices, and reserve stock in the same transaction.
      const resolvedLines: Array<{
        variantId: string;
        productName: string;
        sku: string | null;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }> = [];

      for (const line of requestedLines) {
        const variant = await tx.productVariant.findFirst({
          where: { id: line.variantId, tenantId, deletedAt: null },
          select: {
            id: true,
            sku: true,
            retailPrice: true,
            stockQuantity: true,
            product: { select: { name: true, isArchived: true, deletedAt: true } },
          },
        });

        if (!variant || variant.product.isArchived || variant.product.deletedAt) {
          throw new OutOfStockError('OUT_OF_STOCK');
        }

        // Atomic guarded decrement — concurrent buyers for the last unit cannot
        // both succeed (the loser matches 0 rows and we 409/out-of-stock).
        const decremented = await tx.productVariant.updateMany({
          where: { id: variant.id, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (decremented.count === 0) {
          throw new OutOfStockError('OUT_OF_STOCK');
        }

        const unitPrice = new Prisma.Decimal(variant.retailPrice.toString());
        const lineTotal = unitPrice.times(line.quantity);
        resolvedLines.push({
          variantId: variant.id,
          productName: variant.product.name,
          sku: variant.sku ?? null,
          quantity: line.quantity,
          unitPrice,
          lineTotal,
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            variantId: variant.id,
            quantityDelta: -line.quantity,
            quantityBefore: variant.stockQuantity,
            quantityAfter: variant.stockQuantity - line.quantity,
            reason: 'WEBSITE_ORDER' as StockMovementReason,
            note: `Website order reservation`,
            actorId: null,
          },
        });
      }

      const hasLines = resolvedLines.length > 0;
      const computedCodAmount = resolvedLines.reduce(
        (sum, l) => sum.plus(l.lineTotal),
        new Prisma.Decimal(0),
      );
      const computedItemCount = resolvedLines.reduce((sum, l) => sum + l.quantity, 0);

      const created = await tx.delivery.create({
        data: {
          tenantId,
          source: 'WEBSITE_CHECKOUT',
          status: 'PLACED',
          orderRef,
          // Server-computed when lines are supplied; the client scalar is only a
          // fallback for legacy payloads that send no lines.
          codAmount: (hasLines
            ? computedCodAmount
            : new Prisma.Decimal(input.codAmount ?? 0)
          ).toFixed(2),
          itemCount: hasLines ? computedItemCount : (input.itemCount ?? 1),
          totalWeightKg:
            input.totalWeightKg !== undefined
              ? new Prisma.Decimal(input.totalWeightKg.toString()).toFixed(2)
              : null,
          shippingFee: shipping.shippingFee,
          notes: input.notes ?? null,
          paymentMethod,
          paymentStatus,
        },
        include: { address: true },
      });

      if (hasLines) {
        await tx.deliveryLine.createMany({
          data: resolvedLines.map((l) => ({
            tenantId,
            deliveryId: created.id,
            variantId: l.variantId,
            productNameSnapshot: l.productName,
            skuSnapshot: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        });
      }

      const address = await tx.shippingAddress.create({
        data: {
          tenantId,
          fullName: input.fullName,
          phone: input.phone,
          phone2: input.phone2 ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          cityName: input.cityName,
          cityId: shipping.destinationCityId ?? null,
          districtName: input.districtName ?? null,
          districtId: shipping.destinationDistrictId ?? null,
          postalCode: input.postalCode ?? null,
        },
      });

      await tx.delivery.update({ where: { id: created.id }, data: { addressId: address.id } });

      await tx.deliveryEvent.create({
        data: {
          tenantId,
          deliveryId: created.id,
          status: 'PLACED',
          source: 'WEBSITE',
          remarks: 'Order placed from website checkout',
          eventAt: new Date(),
        },
      });

      return { ...created, orderRef };
    },
    { timeout: 20_000 },
  );

  void createAuditLog({
    tenantId,
    actorId: null,
    actorRole: 'UNKNOWN',
    entityType: 'Delivery',
    entityId: delivery.id,
    action: AUDIT_ACTIONS.DELIVERY_CREATED,
    after: { source: 'WEBSITE_CHECKOUT', orderRef: delivery.orderRef } as Prisma.InputJsonValue,
  });

  return {
    deliveryId: delivery.id,
    orderRef: delivery.orderRef,
    shippingFee: shipping.shippingFee,
  };
}

/**
 * Bulk status change for selected order deliveries. Updates `status` and writes
 * a `DeliveryEvent` per delivery. Returns per-id results.
 */
export async function bulkChangeOrderStatus(
  tenantId: string,
  userId: string,
  input: BulkStatusChangeInput,
): Promise<BulkResultItem[]> {
  setSentryTenantContext({ tenantId });

  const deliveries = await prisma.delivery.findMany({
    where: { id: { in: input.deliveryIds }, tenantId, deletedAt: null },
    select: { id: true, orderRef: true, status: true },
  });

  const results: BulkResultItem[] = [];
  for (const delivery of deliveries) {
    if (delivery.status === input.status) {
      results.push({ id: delivery.id, ok: false, message: 'Already in this status' });
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.delivery.update({ where: { id: delivery.id }, data: { status: input.status } });
        await tx.deliveryEvent.create({
          data: {
            tenantId,
            deliveryId: delivery.id,
            status: input.status as DeliveryStatus,
            source: 'MANUAL',
            remarks: `Status changed to ${input.status}`,
            eventAt: new Date(),
          },
        });
      });
      results.push({ id: delivery.id, ok: true });
    } catch (error) {
      results.push({
        id: delivery.id,
        ok: false,
        message: error instanceof Error ? error.message : 'Update failed',
      });
    }
  }

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'Delivery',
    entityId: `${input.deliveryIds.join(',')}`,
    action: AUDIT_ACTIONS.DELIVERY_STATUS_CHANGED,
    after: {
      status: input.status,
      count: results.filter((r) => r.ok).length,
    } as Prisma.InputJsonValue,
  });

  return results;
}

/**
 * Bulk "prepare for delivery" for selected orders. Advances any delivery that
 * is still in a pre-dispatch state to `PENDING_DISPATCH` (the dispatch-ready
 * state) so staff don't have to open the delivery page. Already-dispatched or
 * later-state orders are skipped and reported.
 */
export async function bulkCreateDeliveries(
  tenantId: string,
  userId: string,
  input: BulkCreateDeliveryInput,
): Promise<BulkResultItem[]> {
  setSentryTenantContext({ tenantId });

  const deliveries = await prisma.delivery.findMany({
    where: { id: { in: input.deliveryIds }, tenantId, deletedAt: null },
    select: { id: true, orderRef: true, status: true },
  });

  const results: BulkResultItem[] = [];
  for (const delivery of deliveries) {
    if (!isPreDispatch(delivery.status)) {
      results.push({
        id: delivery.id,
        ok: false,
        message: `Cannot prepare order in ${delivery.status}`,
      });
      continue;
    }
    if (delivery.status === 'PENDING_DISPATCH') {
      results.push({ id: delivery.id, ok: false, message: 'Already ready for delivery' });
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.delivery.update({
          where: { id: delivery.id },
          data: { status: 'PENDING_DISPATCH' },
        });
        await tx.deliveryEvent.create({
          data: {
            tenantId,
            deliveryId: delivery.id,
            status: 'PENDING_DISPATCH',
            source: 'MANUAL',
            remarks: 'Prepared for delivery (bulk)',
            eventAt: new Date(),
          },
        });
      });
      results.push({ id: delivery.id, ok: true });
    } catch (error) {
      results.push({
        id: delivery.id,
        ok: false,
        message: error instanceof Error ? error.message : 'Update failed',
      });
    }
  }

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'Delivery',
    entityId: `${input.deliveryIds.join(',')}`,
    action: AUDIT_ACTIONS.DELIVERY_STATUS_CHANGED,
    after: { preparedCount: results.filter((r) => r.ok).length } as Prisma.InputJsonValue,
  });

  return results;
}
