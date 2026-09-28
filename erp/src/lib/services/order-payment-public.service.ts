import 'server-only';

import { prisma } from '@/lib/prisma';
import type { OrderPaymentStatus } from '@/generated/prisma/client';

/**
 * Public order-payment status read.
 *
 * PayHere's `return_url` carries **no payment status** — it is only a browser
 * redirect, and the authoritative outcome arrives at `notify_url` later. The
 * confirmation page therefore looks the order up here, by reference, and reads
 * the status the IPN wrote. The storefront never trusts the query string.
 *
 * The response is customer-safe: no internal ids, no tenant id, no gateway
 * signature. Lookup is scoped by `tenantId` + `orderRef` so one storefront can
 * never read another tenant's order, and it is keyed on the order reference
 * (which the customer already has) rather than the delivery id.
 */

export interface PublicOrderPayment {
  orderRef: string;
  /** `PENDING` | `PAID` | `FAILED` | `REFUNDED` */
  paymentStatus: OrderPaymentStatus;
  /** `COD` | `CARD` */
  paymentMethod: string;
  /** Friendly wording for the storefront. */
  paymentLabel: string;
  /** Payable total (goods + delivery fee), 2dp string. */
  total: string;
  currency: string;
  /** Delivery status, so a paid order can show it is being prepared. */
  orderStatus: string;
  placedAt: string;
  /** The card method used (VISA/GENIE/EZCASH/…), when the gateway reported it. */
  cardMethod: string | null;
}

/**
 * Customer-facing wording for a payment status. Kept here (not in the UI) so
 * the ERP and the storefront cannot drift apart.
 */
export function payhereStatusLabel(
  method: string,
  status: OrderPaymentStatus,
): string {
  if (method !== 'CARD') {
    return status === 'PAID' ? 'Paid' : 'Payable on delivery (cash)';
  }
  switch (status) {
    case 'PAID':
      return 'Payment received — thank you';
    case 'REFUNDED':
      return 'Payment refunded';
    case 'FAILED':
      return 'Payment was not completed';
    default:
      return 'Awaiting card payment';
  }
}

/**
 * Look up one website order's payment state by its order reference.
 * Returns `null` when the reference does not belong to the tenant.
 */
export async function getPublicOrderPayment(
  tenantId: string,
  orderRef: string,
): Promise<PublicOrderPayment | null> {
  const order = await prisma.delivery.findFirst({
    where: {
      tenantId,
      orderRef: orderRef.trim(),
      source: 'WEBSITE_CHECKOUT',
      deletedAt: null,
    },
    select: {
      orderRef: true,
      paymentStatus: true,
      paymentMethod: true,
      payhereMethod: true,
      codAmount: true,
      shippingFee: true,
      status: true,
      createdAt: true,
    },
  });

  if (!order) return null;

  const goods = Number.parseFloat(String(order.codAmount ?? 0));
  const shipping = Number.parseFloat(String(order.shippingFee ?? 0));
  const total = (
    (Number.isFinite(goods) ? goods : 0) + (Number.isFinite(shipping) ? shipping : 0)
  ).toFixed(2);

  return {
    orderRef: order.orderRef,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentLabel: payhereStatusLabel(order.paymentMethod, order.paymentStatus),
    total,
    currency: 'LKR',
    orderStatus: order.status,
    placedAt: order.createdAt.toISOString(),
    cardMethod: order.payhereMethod ?? null,
  };
}
