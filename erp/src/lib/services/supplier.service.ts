import { prisma } from '@/lib/prisma';
import { SL_PHONE_REGEX } from '@/lib/constants/supplier';
import { ApiError } from '@/lib/api/errors';
import { lockForUpdate } from '@/lib/api/race-guard';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { findDuplicateSupplierName } from '@/lib/services/supplierDuplicateName.core';
import { findSupplierPhoneClash } from '@/lib/services/supplierPhone.core';
import { supplierAuditSnapshot } from '@/lib/services/supplierAudit.core';

/** Actor passed from the route so the supplier trail records who acted. */
export interface SupplierActor {
  id: string;
  role: string;
}

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

export async function createSupplier(
  tenantId: string,
  data: CreateSupplierData,
  actor: SupplierActor,
) {
  validatePhone(data.phone);
  if (data.whatsappNumber !== undefined && data.whatsappNumber !== '') {
    validatePhone(data.whatsappNumber);
  }

  // ARGUS #236: phone uniqueness is keyed on the canonical number, not the raw
  // display string. Lock the tenant row so two concurrent creates in different
  // valid formats ("+9477..." vs "077...") serialise before the pre-check; the
  // raw `@@unique([tenantId, phone])` alone cannot see across formats.
  const created = await prisma.$transaction(async (tx) => {
    await lockForUpdate(tx, 'tenants', '"id" = $1', [tenantId]);

    // M06-01 (BUG-30 / D5): archived rows RESERVE their phone too (same D4
    // policy as Category/Brand/Customer), so the pre-check is archive-agnostic.
    const existing = await tx.supplier.findMany({
      where: { tenantId },
      select: { id: true, name: true, phone: true, isActive: true },
    });
    const phoneClash = findSupplierPhoneClash(data.phone, existing);
    if (phoneClash) {
      throw ApiError.conflict(
        phoneClash.isActive
          ? 'A supplier with this phone number already exists'
          : 'A supplier with this phone number already exists (an archived record uses this phone)',
      );
    }

    // M06-01 (D5): name is NOT unique — a live same-name row only raises a
    // duplicateName warning flag on the 201 response (warn-only, never 409).
    // ARGUS #235: compare normalised names, so case/whitespace cannot slip a
    // duplicate past the warning.
    const duplicate = findDuplicateSupplierName(
      data.name,
      existing.filter((row) => row.isActive),
    );

    const supplier = await tx.supplier.create({
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

    return { ...supplier, duplicateName: duplicate.duplicateName };
  });

  // ARGUS #237: the audit trail had restore events only. Record the create with
  // the actor and the full editable snapshot.
  void createAuditLog({
    tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'Supplier',
    entityId: created.id,
    action: AUDIT_ACTIONS.SUPPLIER_CREATED,
    after: supplierAuditSnapshot(created),
  }).catch(() => {});

  return created;
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
  actor: SupplierActor,
) {
  if (data.phone !== undefined) {
    validatePhone(data.phone);
  }
  if (data.whatsappNumber !== undefined && data.whatsappNumber !== '') {
    validatePhone(data.whatsappNumber);
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockForUpdate(tx, 'tenants', '"id" = $1', [tenantId]);

    const existing = await tx.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!existing) {
      throw new Error('Supplier not found');
    }

    // M06-05 (OBS-11): archived rows are read-only until restored — the
    // unarchive route is the explicit recovery path (restore-first policy).
    if (!existing.isActive) {
      throw ApiError.conflict('Archived suppliers must be restored before editing');
    }

    // ARGUS #236: renaming onto a number already reserved in either valid
    // format is the same hard conflict as create. Only check when the phone
    // actually changes, excluding the row being edited.
    if (data.phone !== undefined && data.phone !== existing.phone) {
      const rows = await tx.supplier.findMany({
        where: { tenantId },
        select: { id: true, phone: true, isActive: true },
      });
      const phoneClash = findSupplierPhoneClash(data.phone, rows, supplierId);
      if (phoneClash) {
        throw ApiError.conflict(
          phoneClash.isActive
            ? 'A supplier with this phone number already exists'
            : 'A supplier with this phone number already exists (an archived record uses this phone)',
        );
      }
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

    // ARGUS #235: renaming onto another live supplier's name is a soft warning,
    // exactly like create. Only compute it when the name actually changes, and
    // always exclude the row being edited so it never matches itself.
    let duplicateName = false;
    if (data.name !== undefined && data.name !== existing.name) {
      const rows = await tx.supplier.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
      });
      duplicateName = findDuplicateSupplierName(data.name, rows, supplierId).duplicateName;
    }

    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data: updateData,
    });

    return { ...updated, duplicateName, before: existing };
  });

  // ARGUS #237: before/after captured from the same transaction that held the
  // tenant lock, so the snapshot cannot describe a different supplier state.
  void createAuditLog({
    tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'Supplier',
    entityId: supplierId,
    action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
    before: supplierAuditSnapshot(result.before),
    after: supplierAuditSnapshot(result),
  }).catch(() => {});

  const { before: _before, ...updated } = result;
  return updated;
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

export async function archiveSupplier(
  tenantId: string,
  supplierId: string,
  actor: SupplierActor,
) {
  const existing = await assertSupplierBelongsToTenant(tenantId, supplierId);

  const archived = await prisma.supplier.update({
    where: { id: supplierId },
    data: { isActive: false },
  });

  // ARGUS #237: mirror unarchive (idempotent 200) and only audit the actual
  // active -> archived transition, so a double archive does not spam the trail.
  if (existing.isActive) {
    void createAuditLog({
      tenantId,
      actorId: actor.id,
      actorRole: actor.role,
      entityType: 'Supplier',
      entityId: supplierId,
      action: AUDIT_ACTIONS.SUPPLIER_ARCHIVED,
      before: supplierAuditSnapshot(existing),
      after: supplierAuditSnapshot(archived),
    }).catch(() => {});
  }

  return archived;
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
