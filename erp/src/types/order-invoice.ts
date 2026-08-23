/**
 * Order / Shipping invoice payload. Assembled server-side (see
 * `order-invoice.service.ts`) and consumed by the printable `OrderInvoice`
 * component. Decimal money values are serialized to numbers.
 */
export interface OrderInvoiceLine {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface OrderInvoiceCustomer {
  name: string;
  phone: string;
  email?: string | null;
}

export interface OrderInvoiceAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  postalCode?: string | null;
}

export interface OrderInvoiceData {
  orderRef: string;
  createdAt: string;
  // Branding resolved from the tenant label template (keeps label/invoice coherent).
  brandName: string;
  logoUrl: string | null;
  accentColor: string;
  borderColor: string;
  customer?: OrderInvoiceCustomer | null;
  address?: OrderInvoiceAddress | null;
  lines: OrderInvoiceLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingFee: number | null;
  deliveryFee: number | null;
  codAmount: number;
  totalAmount: number;
}
