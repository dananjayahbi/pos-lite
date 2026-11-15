import 'server-only';

import { prisma } from '@/lib/prisma';
import { getTenantBranding } from '@/lib/tenant-branding';
import type { OrderInvoiceData, OrderInvoiceLine } from '@/types/order-invoice';

/** Invoice chrome stays neutral: the waybill design owns the courier palette. */
const INVOICE_ACCENT = '#3A2D28';
const INVOICE_BORDER = '#3A2D28';

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

/** Website orders have no Sale; their snapshot lines live on DeliveryLine. */
export interface DeliveryLineSource {
  skuSnapshot: string | null;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: { toNumber(): number };
  lineTotal: { toNumber(): number };
}

export function mapDeliveryInvoiceLines(lines: DeliveryLineSource[]): OrderInvoiceLine[] {
  return lines.map((line) => ({
    sku: line.skuSnapshot ?? '',
    description: line.productNameSnapshot,
    quantity: line.quantity,
    unitPrice: toNumber(line.unitPrice),
    discountAmount: 0,
    lineTotal: toNumber(line.lineTotal),
  }));
}

/**
 * Chooses the invoice's line source: POS sale lines are authoritative, but a
 * linked sale with no lines must not blank the table when the delivery itself
 * has item snapshots.
 */
export function selectInvoiceLines(
  saleLines: OrderInvoiceLine[],
  deliveryLines: OrderInvoiceLine[],
): OrderInvoiceLine[] {
  return saleLines.length > 0 ? saleLines : deliveryLines;
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
      lines: { orderBy: { createdAt: 'asc' as const } },
      sale: {
        include: {
          lines: true,
        },
      },
    },
  });

  if (!delivery) throw new Error('DELIVERY_NOT_FOUND');

  const branding = await getTenantBranding(tenantId);

  const sale = delivery.sale;
  // POS sales carry the authoritative item lines. Website/manual deliveries
  // carry DeliveryLine snapshots instead. Prefer sale lines, but fall back to
  // delivery lines when the linked sale has no lines (e.g. a zero-value sale),
  // otherwise the invoice table would render empty while the delivery does
  // have items.
  const saleLines = sale ? mapInvoiceLines(sale.lines) : [];
  const deliveryLines = mapDeliveryInvoiceLines(delivery.lines);
  const lines = selectInvoiceLines(saleLines, deliveryLines);
  const lineSubtotal = lines.reduce((total, line) => total + line.lineTotal, 0);
  const shippingFee = delivery.shippingFee != null ? toNumber(delivery.shippingFee) : null;

  return {
    orderRef: delivery.orderRef,
    createdAt: delivery.createdAt.toISOString(),
    brandName: branding.name,
    logoUrl: branding.logoUrl,
    accentColor: INVOICE_ACCENT,
    borderColor: INVOICE_BORDER,
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
    subtotal: sale && saleLines.length > 0 ? toNumber(sale.subtotal) : lineSubtotal || toNumber(delivery.codAmount),
    discountAmount: sale ? toNumber(sale.discountAmount) : 0,
    taxAmount: sale ? toNumber(sale.taxAmount) : 0,
    shippingFee,
    deliveryFee: delivery.deliveryFee != null ? toNumber(delivery.deliveryFee) : null,
    codAmount: toNumber(delivery.codAmount),
    // The website total is goods + shipping; a sale already stores its own
    // delivery charge in totalAmount, so only add shipping for website orders.
    totalAmount: sale
      ? toNumber(sale.totalAmount)
      : (lineSubtotal || toNumber(delivery.codAmount)) + (shippingFee ?? 0),
    paymentMethod: delivery.paymentMethod,
    paymentStatus: delivery.paymentStatus,
    paymentDetail: delivery.payhereMethod,
  };
}
