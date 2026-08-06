import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import type { BulkStatusChangeInput, BulkCreateDeliveryInput, BulkResultItem } from '@/lib/validators/order.validators';
import type { WebsiteCheckoutInput } from '@/lib/validators/checkout.validators';
import type { DeliveryStatus } from '@/generated/prisma/client';

/** Statuses from which an order may be advanced into the dispatch pipeline. */
const PRE_DISPATCH_STATUSES = ['PLACED', 'HOLD', 'PENDING_DISPATCH'] as const;

function isPreDispatch(status: string): boolean {
  return (PRE_DISPATCH_STATUSES as readonly string[]).includes(status);
}

/** Generate a human-friendly order reference for a tenant. */
async function generateOrderRef(tenantId: string): Promise<string> {
  const count = await prisma.delivery.count({ where: { tenantId } });
  return `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Create a website order as a `Delivery` (source WEBSITE_CHECKOUT, status
 * PLACED) with a shipping-address snapshot. Used by the public checkout
 * endpoint so online orders appear immediately in the ERP Orders page.
 */
export async function createWebsiteOrder(
  tenantId: string,
  input: WebsiteCheckoutInput,
): Promise<{ deliveryId: string; orderRef: string }> {
  setSentryTenantContext({ tenantId });

  const orderRef = await generateOrderRef(tenantId);

  const delivery = await prisma.$transaction(async (tx) => {
    const created = await tx.delivery.create({
      data: {
        tenantId,
        source: 'WEBSITE_CHECKOUT',
        status: 'PLACED',
        orderRef,
        codAmount: new Prisma.Decimal(input.codAmount ?? 0).toFixed(2),
        itemCount: input.itemCount ?? 1,
        totalWeightKg:
          input.totalWeightKg !== undefined
            ? new Prisma.Decimal(input.totalWeightKg.toString()).toFixed(2)
            : null,
        notes: input.notes ?? null,
      },
      include: { address: true },
    });

    const address = await tx.shippingAddress.create({
      data: {
        tenantId,
        fullName: input.fullName,
        phone: input.phone,
        phone2: input.phone2 ?? null,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        cityName: input.cityName,
        districtName: input.districtName ?? null,
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

    return created;
  });

  void createAuditLog({
    tenantId,
    actorId: null,
    actorRole: 'UNKNOWN',
    entityType: 'Delivery',
    entityId: delivery.id,
    action: AUDIT_ACTIONS.DELIVERY_CREATED,
    after: { source: 'WEBSITE_CHECKOUT', orderRef } as Prisma.InputJsonValue,
  });

  return { deliveryId: delivery.id, orderRef };
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
      results.push({ id: delivery.id, ok: false, message: error instanceof Error ? error.message : 'Update failed' });
    }
  }

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'Delivery',
    entityId: `${input.deliveryIds.join(',')}`,
    action: AUDIT_ACTIONS.DELIVERY_STATUS_CHANGED,
    after: { status: input.status, count: results.filter((r) => r.ok).length } as Prisma.InputJsonValue,
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
      results.push({ id: delivery.id, ok: false, message: `Cannot prepare order in ${delivery.status}` });
      continue;
    }
    if (delivery.status === 'PENDING_DISPATCH') {
      results.push({ id: delivery.id, ok: false, message: 'Already ready for delivery' });
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.delivery.update({ where: { id: delivery.id }, data: { status: 'PENDING_DISPATCH' } });
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
      results.push({ id: delivery.id, ok: false, message: error instanceof Error ? error.message : 'Update failed' });
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
