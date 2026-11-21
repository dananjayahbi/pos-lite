/**
 * Plain, JSON-safe snapshots for purchase-order audit rows (ARGUS #229).
 *
 * Prisma returns `Decimal` objects and `Date` instances. Audit `before`/`after`
 * are JSON columns, so every value is flattened to a primitive here instead of
 * relying on the driver's serialisation. Keeping this pure lets the audit rows
 * be tested without a database or a mocked Prisma client.
 */

import type { Prisma } from '@/generated/prisma/client';

type Decimalish = number | string | { toString(): string };

export interface PurchaseOrderAuditSource {
  referenceNo: string;
  status: string;
  supplierId: string;
  orderDate: Date | string;
  expectedDeliveryDate?: Date | string | null | undefined;
  subtotalAmount: Decimalish;
  discountType?: string | null | undefined;
  discountValue: Decimalish;
  discountAmount: Decimalish;
  totalAmount: Decimalish;
  paymentTermDays?: number | null | undefined;
  notes?: string | null | undefined;
}

/** Structured like a Prisma JSON object so it can be written to `AuditLog`. */
export type PurchaseOrderAuditSnapshot = Prisma.InputJsonObject & {
  referenceNo: string;
  status: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  subtotalAmount: number;
  discountType: string | null;
  discountValue: number;
  discountAmount: number;
  totalAmount: number;
  paymentTermDays: number | null;
  notes: string | null;
};

function dateIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function amount(value: Decimalish): number {
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function purchaseOrderAuditSnapshot(
  po: PurchaseOrderAuditSource,
): PurchaseOrderAuditSnapshot {
  return {
    referenceNo: po.referenceNo,
    status: po.status,
    supplierId: po.supplierId,
    orderDate: dateIso(po.orderDate) ?? '',
    expectedDeliveryDate: dateIso(po.expectedDeliveryDate),
    subtotalAmount: amount(po.subtotalAmount),
    discountType: po.discountType ?? null,
    discountValue: amount(po.discountValue),
    discountAmount: amount(po.discountAmount),
    totalAmount: amount(po.totalAmount),
    paymentTermDays: po.paymentTermDays ?? null,
    notes: po.notes ?? null,
  };
}
