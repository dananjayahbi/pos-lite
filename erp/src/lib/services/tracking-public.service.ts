import 'server-only';

import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import {
  mapCustomerDeliveryStatus,
  type DeliveryStatusMapping,
} from '@/lib/tracking/public-status';
import type { DeliveryStatus, OrderPaymentStatus } from '@/generated/prisma/client';

/**
 * Public tracking read service — exposes a customer-safe view of an order's
 * delivery state. Joins the internal `Delivery` + `DeliveryEvent` pipeline
 * (populated by `tracking.service.ts` and the sync-shipments cron) into a
 * clean shape for the storefront. Never exposes raw courier enums.
 */

/** A single customer-safe timeline entry. */
export interface PublicTrackingEvent {
  id: string;
  /** Friendly stage key. */
  stage: string;
  /** Friendly label. */
  label: string;
  /** Raw remarks, only when safe/short (null otherwise). */
  remarks?: string | null;
  /** True if this event is the current/most recent. */
  isCurrent: boolean;
  timestamp: string;
}

/** Public, customer-safe order tracking summary. */
export interface PublicTrackingOrder {
  orderRef: string;
  status: DeliveryStatusMapping;
  /** Friendly overall payment wording (COD = payable on delivery). */
  payment: string;
  /** Delivery/payment dates exposed to the customer. */
  placedAt?: string | null;
  deliveredAt?: string | null;
  /** Ordered, deduplicated timeline. */
  events: PublicTrackingEvent[];
}

export interface PublicTrackingLookupInput {
  /** Matched against `orderRef`. */
  orderRef?: string | undefined;
  /** Matched against the shipping address phone (case-insensitive prefix). */
  phone?: string | undefined;
  /** Optional waybill (courier) reference. */
  waybill?: string | undefined;
}

const FRIENDLY_STATUS = new Set<string>([
  'PLACED',
  'PENDING_DISPATCH',
  'HOLD',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELED',
  'RETURNED',
  'PENDING_PICKUP',
]);

function friendlyEventLabel(status: DeliveryStatus | string): string {
  return mapCustomerDeliveryStatus(status).stage.label;
}

function paymentWording(
  method: string | null | undefined,
  status: OrderPaymentStatus | string | null | undefined,
): string {
  if (method === 'CARD') {
    if (status === 'PAID') return 'Paid by card';
    if (status === 'FAILED') return 'Card payment failed';
    if (status === 'REFUNDED') return 'Refunded';
    return 'Card payment pending';
  }
  return 'Payable on delivery (cash)';
}

/**
 * Look up public tracking for a tenant by order reference / phone / waybill.
 * Returns at most a few most-recent website orders to avoid leaking the full
 * customer order history.
 */
export async function getPublicTracking(
  tenantId: string,
  input: PublicTrackingLookupInput,
): Promise<PublicTrackingOrder[]> {
  setSentryTenantContext({ tenantId });

  const hasRef = input.orderRef && input.orderRef.trim().length > 0;
  const hasPhone = input.phone && input.phone.trim().length > 0;
  const hasWaybill = input.waybill && input.waybill.trim().length > 0;

  if (!hasRef && !hasPhone && !hasWaybill) return [];

  // Resolve deliveries by waybill first (courier ref on a shipment).
  let waybillDeliveryIds: string[] = [];
  if (hasWaybill) {
    const shipments = await prisma.courierShipment.findMany({
      where: { tenantId, waybillId: { contains: input.waybill!.trim() } },
      select: { deliveryId: true },
      take: 5,
    });
    waybillDeliveryIds = shipments.map((s) => s.deliveryId);
  }

  const orders = await prisma.delivery.findMany({
    where: {
      tenantId,
      source: 'WEBSITE_CHECKOUT',
      deletedAt: null,
      OR: [
        ...(hasRef ? [{ orderRef: { equals: input.orderRef!.trim() } }] : []),
        ...(hasPhone
          ? [{ address: { phone: { contains: input.phone!.trim() } } }]
          : []),
        ...(waybillDeliveryIds.length > 0
          ? [{ id: { in: waybillDeliveryIds } }]
          : []),
      ],
    },
    include: {
      address: { select: { phone: true, cityName: true } },
      events: {
        orderBy: { eventAt: 'asc' },
        select: {
          id: true,
          status: true,
          remarks: true,
          eventAt: true,
          source: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return orders.map((order) => {
    const mapping = mapCustomerDeliveryStatus(order.status);
    const currentStageKey = mapping.stage.key;

    const events: PublicTrackingEvent[] = order.events.map((ev) => {
      const statusLabel =
        ev.status && FRIENDLY_STATUS.has(ev.status)
          ? friendlyEventLabel(ev.status)
          : undefined;
      return {
        id: ev.id,
        stage: statusLabel ? mapCustomerDeliveryStatus(ev.status).stage.key : currentStageKey,
        label: statusLabel ?? 'Update',
        remarks: ev.remarks && ev.remarks.length <= 140 ? ev.remarks : null,
        isCurrent: ev.eventAt === order.events.at(-1)?.eventAt,
        timestamp: ev.eventAt.toISOString(),
      };
    });

    // Fallback: if no events recorded, emit a single "placed" event.
    if (events.length === 0) {
      events.push({
        id: `placed-${order.id}`,
        stage: 'order-confirmed',
        label: 'Order confirmed',
        remarks: null,
        isCurrent: true,
        timestamp: order.createdAt.toISOString(),
      });
    }

    return {
      orderRef: order.orderRef,
      status: mapping,
      payment: paymentWording(order.paymentMethod, order.paymentStatus),
      placedAt: order.createdAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      events,
    };
  });
}
