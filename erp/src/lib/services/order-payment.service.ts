import 'server-only';

import { OrderPaymentMethod, OrderPaymentStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { getBaseUrl } from '@/lib/utils/url';
import Decimal from 'decimal.js';
import { PAYHERE_PAYMENT_URL } from '@/lib/billing/payhere.service';
import { mapOrderPayhereStatus } from '@/lib/payments/payhere-status';

/**
 * Order-payment service — owns the PayHere integration for customer (website)
 * orders. Keeps gateway payload-building and payment-status handling out of the
 * route handlers so checkout logic stays thin and reusable.
 *
 * The customer "order" is modeled as a `Delivery` (source = WEBSITE_CHECKOUT);
 * we reuse that record's id as the PayHere `order_id` so the IPN webhook can
 * resolve the order directly.
 */

interface OrderLike {
  id: string;
  codAmount: Decimal | { toString(): string };
  orderRef: string;
}

/**
 * Build the PayHere checkout payload for a customer order. Mirrors the billing
 * subscription payload shape so the same gateway flow (auto-submit redirect)
 * can be reused on the storefront.
 */
export function buildOrderPayherePayload(
  order: OrderLike,
  tenant: { id: string; slug: string; name: string },
): {
  payhereUrl: string;
  payload: Record<string, string>;
} {
  const amount = new Decimal(order.codAmount.toString()).toFixed(2);
  const baseUrl = getBaseUrl();

  return {
    payhereUrl: PAYHERE_PAYMENT_URL,
    payload: {
      merchant_id: process.env.PAYHERE_MERCHANT_ID || '',
      return_url: `${baseUrl}/${tenant.slug}/shop?payment=success&order=${order.id}`,
      cancel_url: `${baseUrl}/${tenant.slug}/shop?payment=cancelled&order=${order.id}`,
      notify_url: `${baseUrl}/api/webhooks/payhere`,
      order_id: order.id,
      items: `Order ${order.orderRef}`,
      currency: 'LKR',
      amount,
      first_name: tenant.name,
      last_name: 'Order',
      email: 'order@example.com',
      phone: '0000000000',
      address: tenant.name,
      city: 'Colombo',
      country: 'Sri Lanka',
      custom_1: tenant.id,
      // Prefix distinguishes a customer order from a billing subscription IPN.
      custom_2: `order:${order.id}`,
    },
  };
}

/**
 * Apply a PayHere status code to a customer order (Delivery). Idempotent:
 * an already-PAID order is never downgraded. Writes a DeliveryEvent so the
 * status change is visible in the ERP order timeline.
 */
export async function processOrderPaymentStatus(
  deliveryId: string,
  statusCode: number,
): Promise<{ updated: boolean; status: OrderPaymentStatus }> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, tenantId: true, paymentMethod: true, paymentStatus: true },
  });

  if (!delivery) return { updated: false, status: OrderPaymentStatus.PENDING };

  setSentryTenantContext({ tenantId: delivery.tenantId });

  // COD orders are settled on delivery, not by the gateway — ignore IPNs.
  if (delivery.paymentMethod === OrderPaymentMethod.COD) {
    return { updated: false, status: delivery.paymentStatus };
  }

  const nextStatus = mapOrderPayhereStatus(statusCode);
  if (nextStatus === delivery.paymentStatus) {
    return { updated: false, status: delivery.paymentStatus };
  }

  // Never downgrade an already-settled paid order.
  if (
    delivery.paymentStatus === OrderPaymentStatus.PAID &&
    nextStatus !== OrderPaymentStatus.REFUNDED
  ) {
    return { updated: false, status: delivery.paymentStatus };
  }

  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: deliveryId },
      data: { paymentStatus: nextStatus },
    });
    await tx.deliveryEvent.create({
      data: {
        tenantId: delivery.tenantId,
        deliveryId,
        status: 'PLACED',
        source: 'PAYMENT_GATEWAY',
        remarks: `Payment ${nextStatus.toLowerCase()} (status code ${statusCode})`,
        eventAt: new Date(),
      },
    });
  });

  return { updated: true, status: nextStatus };
}
