import 'server-only';

import { prisma } from '@/lib/prisma';
import { getLabelTemplate } from '@/lib/services/label.service';
import type { OrderInvoiceData, OrderInvoiceLine } from '@/types/order-invoice';

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number((value as { toNumber(): number }).toNumber());
}

/** A minimal sale-line shape as returned by Prisma (Decimal fields). */
export interface InvoiceLineSource {
  sku: string;
  variantDescriptionSnapshot: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: { toNumber(): number };
  discountAmount: { toNumber(): number };
  lineTotalAfterDiscount: { toNumber(): number };
}

/** Map Prisma sale lines into plain invoice line items. Pure + testable. */
export function mapInvoiceLines(lines: InvoiceLineSource[]): OrderInvoiceLine[] {
  return lines.map((line) => ({
    sku: line.sku,
    description: line.variantDescriptionSnapshot || line.productNameSnapshot,
    quantity: line.quantity,
    unitPrice: toNumber(line.unitPrice),
    discountAmount: toNumber(line.discountAmount),
    lineTotal: toNumber(line.lineTotalAfterDiscount),
  }));
}

/**
 * Assemble the printable invoice payload for a delivery (order). Fetches the
 * sale + line items, customer, shipping address, shipping fee and totals, and
 * resolves the tenant's branding from the label template so invoices match the
 * existing shipping-label branding. Throws `DELIVERY_NOT_FOUND` if missing.
 */
export async function getOrderInvoiceData(
  tenantId: string,
  deliveryId: string,
): Promise<OrderInvoiceData> {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, tenantId, deletedAt: null },
    include: {
      address: true,
      customer: { select: { name: true, phone: true, email: true } },
      sale: {
        include: {
          lines: true,
        },
      },
    },
  });

  if (!delivery) throw new Error('DELIVERY_NOT_FOUND');

  const branding = await getLabelTemplate(tenantId);

  const lines: OrderInvoiceLine[] = mapInvoiceLines(delivery.sale?.lines ?? ([] as InvoiceLineSource[]));

  const sale = delivery.sale;

  return {
    orderRef: delivery.orderRef,
    createdAt: delivery.createdAt.toISOString(),
    brandName: branding.brandName,
    logoUrl: branding.logoUrl,
    accentColor: branding.accentColor,
    borderColor: branding.borderColor,
    customer: delivery.customer
      ? {
          name: delivery.customer.name,
          phone: delivery.customer.phone,
          email: delivery.customer.email,
        }
      : null,
    address: delivery.address
      ? {
          fullName: delivery.address.fullName,
          phone: delivery.address.phone,
          addressLine1: delivery.address.addressLine1,
          addressLine2: delivery.address.addressLine2,
          cityName: delivery.address.cityName,
          districtName: delivery.address.districtName,
          postalCode: delivery.address.postalCode,
        }
      : null,
    lines,
    subtotal: sale ? toNumber(sale.subtotal) : toNumber(delivery.codAmount),
    discountAmount: sale ? toNumber(sale.discountAmount) : 0,
    taxAmount: sale ? toNumber(sale.taxAmount) : 0,
    shippingFee: delivery.shippingFee != null ? toNumber(delivery.shippingFee) : null,
    deliveryFee: delivery.deliveryFee != null ? toNumber(delivery.deliveryFee) : null,
    codAmount: toNumber(delivery.codAmount),
    totalAmount: sale ? toNumber(sale.totalAmount) : toNumber(delivery.codAmount),
  };
}
