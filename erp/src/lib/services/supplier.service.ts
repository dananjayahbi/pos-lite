import { prisma } from '@/lib/prisma';
import { SL_PHONE_REGEX } from '@/lib/constants/supplier';
import { ApiError } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

// ── Phone Regex ──────────────────────────────────────────────────────────────

// ── Private Helpers ──────────────────────────────────────────────────────────

async function assertSupplierBelongsToTenant(tenantId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
  });
  if (!supplier) {
    throw new Error('Supplier not found');
  }
  return supplier;
}

function validatePhone(phone: string) {
  if (!SL_PHONE_REGEX.test(phone)) {
    throw new Error('Invalid phone number format. Use +94XXXXXXXXX or 07XXXXXXXX');
  }
}

// ── Create ───────────────────────────────────────────────────────────────────

interface CreateSupplierData {
  name: string;
  contactName?: string | undefined;
  phone: string;
  whatsappNumber?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  leadTimeDays?: number | undefined;
  notes?: string | undefined;
}

export async function createSupplier(tenantId: string, data: CreateSupplierData) {
  validatePhone(data.phone);
  if (data.whatsappNumber !== undefined && data.whatsappNumber !== '') {
    validatePhone(data.whatsappNumber);
  }

  // M06-01 (BUG-30 / D5): phone is the contact key — hard-unique per tenant.
  // Archived (isActive:false) rows RESERVE their phone too (same D4 policy as
  // Category/Brand/Customer), so the pre-check is archive-agnostic and
  // surfaces the friendly 409; @@unique([tenantId, phone]) + mapPrismaError
  // catch race losers with P2002 → 409, never a 500.
  const phoneClash = await prisma.supplier.findFirst({
    where: { tenantId, phone: data.phone },
    select: { id: true, isActive: true },
  });
  if (phoneClash) {
    throw ApiError.conflict(
      phoneClash.isActive
        ? 'A supplier with this phone number already exists'
        : 'A supplier with this phone number already exists (an archived record uses this phone)',
    );
  }

  // M06-01 (D5): name is NOT unique — a live same-name row only raises a
  // duplicateName warning flag on the 201 response (warn-only, never 409).
  const nameClash = await prisma.supplier.findFirst({
    where: { tenantId, name: data.name, isActive: true },
    select: { id: true },
  });

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      name: data.name,
      phone: data.phone,
      whatsappNumber: data.whatsappNumber !== undefined && data.whatsappNumber !== ''
        ? data.whatsappNumber
        : data.phone,
      ...(data.contactName !== undefined && { contactName: data.contactName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.leadTimeDays !== undefined && { leadTimeDays: data.leadTimeDays }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return { ...supplier, duplicateName: nameClash !== null };
}

// ── Update ───────────────────────────────────────────────────────────────────

interface UpdateSupplierData {
  name?: string | undefined;
  contactName?: string | undefined;
  phone?: string | undefined;
  whatsappNumber?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  leadTimeDays?: number | undefined;
  notes?: string | undefined;
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  data: UpdateSupplierData,
) {
  const existing = await assertSupplierBelongsToTenant(tenantId, supplierId);

  // M06-05 (OBS-11): archived rows are read-only until restored — the
  // unarchive route is the explicit recovery path (restore-first policy).
  if (!existing.isActive) {
    throw ApiError.conflict('Archived suppliers must be restored before editing');
  }

  if (data.phone !== undefined) {
    validatePhone(data.phone);
  }
  if (data.whatsappNumber !== undefined && data.whatsappNumber !== '') {
    validatePhone(data.whatsappNumber);
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.whatsappNumber !== undefined) {
    updateData.whatsappNumber = data.whatsappNumber !== '' ? data.whatsappNumber : (data.phone ?? null);
  }
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.leadTimeDays !== undefined) updateData.leadTimeDays = data.leadTimeDays;
  if (data.notes !== undefined) updateData.notes = data.notes;

  return prisma.supplier.update({
    where: { id: supplierId },
    data: updateData,
  });
}

// ── Get by ID ────────────────────────────────────────────────────────────────

export async function getSupplierById(tenantId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    include: {
      _count: { select: { purchaseOrders: true } },
    },
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  return supplier;
}

// ── List ─────────────────────────────────────────────────────────────────────

interface GetSuppliersOptions {
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  includeArchived?: boolean | undefined;
}

export async function getSuppliers(tenantId: string, options: GetSuppliersOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };

  if (!options.includeArchived) {
    where.isActive = true;
  }

  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: 'insensitive' } },
      { contactName: { contains: options.search, mode: 'insensitive' } },
      // M06-05 (OBS-9): phone is the primary contact key (and the uniqueness
      // field post-M06-01) — searchable like Customer's phone, same contains/
      // insensitive convention (prefix and substring both match).
      { phone: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.supplier.count({ where }),
  ]);

  return {
    suppliers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Archive ──────────────────────────────────────────────────────────────────

export async function archiveSupplier(tenantId: string, supplierId: string) {
  await assertSupplierBelongsToTenant(tenantId, supplierId);

  return prisma.supplier.update({
    where: { id: supplierId },
    data: { isActive: false },
  });
}

/**
 * M06-05 (OBS-10) — the two-way recovery path for the one-way archive.
 * Mirrors `archiveSupplier` (same tenant guard, idempotent 200) and audits
 * the actual transition as SUPPLIER_UNARCHIVED with the real actor, matching
 * the product/promotion archive-audit conventions. A double unarchive is a
 * no-op 200 and deliberately does NOT spam the trail.
 */
export async function unarchiveSupplier(
  tenantId: string,
  supplierId: string,
  actor: { id: string; role: string },
) {
  const existing = await assertSupplierBelongsToTenant(tenantId, supplierId);

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: { isActive: true },
  });

  if (!existing.isActive) {
    void createAuditLog({
      tenantId,
      actorId: actor.id,
      actorRole: actor.role,
      entityType: 'Supplier',
      entityId: supplierId,
      action: AUDIT_ACTIONS.SUPPLIER_UNARCHIVED,
      before: { isActive: false },
      after: { isActive: true },
    }).catch(() => {});
  }

  return updated;
}
