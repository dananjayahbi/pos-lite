import { prisma } from '@/lib/prisma';
import { SL_PHONE_REGEX } from '@/lib/constants/supplier';

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

  return prisma.supplier.create({
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
  await assertSupplierBelongsToTenant(tenantId, supplierId);

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
