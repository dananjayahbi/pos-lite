/**
 * JSON-safe supplier snapshots for audit rows (ARGUS #237).
 *
 * Kept pure so the create/update/archive trail can be tested without a database.
 * Every field the supplier form owns is copied; timestamps and ids are not, so
 * the before/after pair describes the editable record only.
 */
import type { Prisma } from '@/generated/prisma/client';

export interface SupplierAuditSource {
  name: string;
  contactName?: string | null | undefined;
  phone: string;
  whatsappNumber?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  leadTimeDays: number;
  notes?: string | null | undefined;
  isActive: boolean;
}

export type SupplierAuditSnapshot = Prisma.InputJsonObject & {
  name: string;
  contactName: string | null;
  phone: string;
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  leadTimeDays: number;
  notes: string | null;
  isActive: boolean;
};

export function supplierAuditSnapshot(supplier: SupplierAuditSource): SupplierAuditSnapshot {
  return {
    name: supplier.name,
    contactName: supplier.contactName ?? null,
    phone: supplier.phone,
    whatsappNumber: supplier.whatsappNumber ?? null,
    email: supplier.email ?? null,
    address: supplier.address ?? null,
    leadTimeDays: supplier.leadTimeDays,
    notes: supplier.notes ?? null,
    isActive: supplier.isActive,
  };
}
