import 'server-only';

import { OrderPaymentMethod, OrderPaymentStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { getBaseUrl, getWebsiteBaseUrl } from '@/lib/utils/url';
import { mapOrderPayhereStatus } from '@/lib/payments/payhere-status';
import {
  buildPayhereRedirect,
  splitFullName,
  type PayhereRedirectPayload,
} from '@/lib/payments/payhere-payload';

/**
 * Order-payment service — owns the PayHere integration for customer (website)
 * orders. Keeps the gateway payload and payment-status handling out of the
 * route handlers so checkout logic stays thin and reusable.
 *
 * The customer "order" is modeled as a `Delivery` (source = WEBSITE_CHECKOUT);
 * we reuse that record's id as the PayHere `order_id` so the IPN webhook can
 * resolve the order directly.
 *
 * The `Delivery` is the single source of truth for a customer payment: the
 * storefront never trusts a query string, it re-reads the status from here
 * after PayHere sends the browser back.
 */

/** What the service needs from a `Delivery` row to build a payment. */
interface OrderLike {
  id: string;
  codAmount: { toString(): string } | number | string;
  orderRef: string;
  tenantId: string;
  shippingFee?: { toString(): string } | number | string | null;
  itemCount?: number;
  lines?: {
    productNameSnapshot: string;
    skuSnapshot: string | null;
    quantity: number;
    unitPrice: { toString(): string } | number | string;
  }[];
  address?: {
    fullName: string;
    phone: string;
    phone2: string | null;
    email: string | null;
    addressLine1: string;
    addressLine2: string | null;
    cityName: string;
  } | null;
}

interface TenantLike {
  id: string;
  slug: string;
  name: string;
}

/**
 * The amount actually payable: goods + delivery fee. The checkout form quotes
 * the same figure, but this is the authoritative computation (server-side, from
 * stored values) so the amount in the hash always matches the order.
 */
export function computeOrderPayableTotal(order: OrderLike): string {
  const goods = Number.parseFloat(String(order.codAmount ?? 0));
  const shipping = Number.parseFloat(String(order.shippingFee ?? 0));
  const goodsValue = Number.isFinite(goods) ? goods : 0;
  const shippingValue = Number.isFinite(shipping) ? shipping : 0;
  return (goodsValue + shippingValue).toFixed(2);
}

/**
 * Build the absolute storefront URL that lands on the confirmation page.
 *
 * PayHere's `return_url`/`cancel_url` send the customer's BROWSER there, so
 * they must target the website origin (`WEBSITE_URL`), not the ERP.
 */
export function buildOrderReturnUrl(
  tenantSlug: string,
  orderRef: string,
  outcome: 'return' | 'cancel',
): string {
  const base = getWebsiteBaseUrl();
  const slug = encodeURIComponent(tenantSlug);
  const ref = encodeURIComponent(orderRef);
  // Both outcomes land on the same route, which re-reads the real status from
  // the ERP. PayHere passes NO status data to return_url, so the route must
  // never depend on the query string for the outcome.
  return outcome === 'return'
    ? `${base}/${slug}/checkout/return?order=${ref}`
    : `${base}/${slug}/checkout/return?order=${ref}&cancelled=1`;
}

/**
 * Build the PayHere checkout payload for a customer order.
 *
 * Returns `null` when the gateway is not configured (no merchant id/secret) —
 * the caller decides whether to fall back to COD or surface an error, rather
 * than shipping a hash-less payload the gateway would reject with
 * "Unauthorized Payment Request".
 */
export function buildOrderPayherePayload(
  order: OrderLike,
  tenant: TenantLike,
  customer: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  },
): PayhereRedirectPayload | null {
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantSecret || merchantSecret.trim() === '') return null;

  const amount = computeOrderPayableTotal(order);
  const baseUrl = getBaseUrl();
  const { firstName, lastName } = splitFullName(customer.fullName);

  return buildPayhereRedirect(
    {
      orderId: order.id,
      items: `Order ${order.orderRef}`,
      amount,
      currency: 'LKR',
      customer: {
        firstName,
        lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
      },
      delivery: {
        address: customer.address,
        city: customer.city,
        country: 'Sri Lanka',
      },
      returnUrl: buildOrderReturnUrl(tenant.slug, order.orderRef, 'return'),
      cancelUrl: buildOrderReturnUrl(tenant.slug, order.orderRef, 'cancel'),
      // PayHere's servers cannot reach localhost — in local development this
      // must be a public tunnel URL (see PAYHERE-INTEGRATION.md §5.3).
      notifyUrl: `${baseUrl}/api/webhooks/payhere`,
      ...(order.lines && order.lines.length > 0
        ? {
            lines: order.lines.slice(0, 20).map((line) => ({
              name: line.productNameSnapshot,
              amount: String(line.unitPrice),
              quantity: line.quantity,
              ...(line.skuSnapshot ? { number: line.skuSnapshot } : {}),
            })),
          }
        : {}),
      custom: {
        custom1: tenant.id,
        // Discriminator: routes the IPN to the order path instead of billing.
        custom2: `order:${order.id}`,
      },
    },
    merchantSecret,
  );
}

/** PayHere IPN details worth keeping on the order. */
export interface OrderPaymentIpnDetails {
  /** `payment_id` — PayHere's unique payment reference. */
  paymentId?: string | null;
  /** `method` — the method the customer actually used (VISA/GENIE/EZCASH/…). */
  method?: string | null;
  /** `status_message` — logged only, never shown raw to the customer. */
  statusMessage?: string | null;
}

/**
 * Apply a PayHere status code to a customer order (Delivery). Idempotent:
 * a settled order is never downgraded, and a repeated IPN is a no-op. Writes a
 * `DeliveryEvent` so the status change is visible in the ERP order timeline.
 */
export async function processOrderPaymentStatus(
  deliveryId: string,
  statusCode: number,
  details: OrderPaymentIpnDetails = {},
): Promise<{ updated: boolean; status: OrderPaymentStatus }> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      tenantId: true,
      paymentMethod: true,
      paymentStatus: true,
    },
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

  // Never downgrade an order that has already been paid.
  if (
    delivery.paymentStatus === OrderPaymentStatus.PAID &&
    nextStatus !== OrderPaymentStatus.REFUNDED
  ) {
    return { updated: false, status: delivery.paymentStatus };
  }

  const gatewayRefs = {
    payhereOrderId: deliveryId,
    ...(details.paymentId ? { payherePaymentId: details.paymentId } : {}),
    ...(details.method ? { payhereMethod: details.method } : {}),
  };

  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: deliveryId },
      // IPN data is only written alongside a real status change, so a retried
      // IPN for an unchanged status cannot churn the row.
      data: { paymentStatus: nextStatus, ...gatewayRefs },
    });
    await tx.deliveryEvent.create({
      data: {
        tenantId: delivery.tenantId,
        deliveryId,
        status: 'PLACED',
        source: 'PAYMENT_GATEWAY',
        remarks:
          `Payment ${nextStatus.toLowerCase()} (status code ${statusCode}` +
          `${details.method ? `, ${details.method}` : ''})`,
        eventAt: new Date(),
      },
    });
  });

  return { updated: true, status: nextStatus };
}
