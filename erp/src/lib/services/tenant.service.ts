import { prisma } from '@/lib/prisma';
import type { TenantStatus } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateTenantInput {
  storeName: string;
  slug: string;
  ownerEmail: string;
  ownerPasswordHash: string;
  timezone: string;
  currency: string;
}

interface GetAllTenantsOptions {
  search?: string;
  status?: TenantStatus;
}

// ── Service Functions ────────────────────────────────────────────────────────

export async function getAllTenants(options: GetAllTenantsOptions = {}) {
  const { search, status } = options;

  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    ...(status && { status }),
  };

  const businesses = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return { businesses, total: businesses.length };
}

export async function getTenantById(tenantId: string) {
  try {
    return await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        users: { take: 5 },
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            products: { where: { deletedAt: null } },
            sales: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('Business not found');
    }
    throw error;
  }
}

export async function createTenant(input: CreateTenantInput) {
  const { storeName, slug, ownerEmail, ownerPasswordHash, timezone, currency } = input;

  // Check if 2 businesses already exist
  const existingCount = await prisma.tenant.count({ where: { deletedAt: null } });
  if (existingCount >= 2) {
    throw new Error('Maximum of 2 businesses allowed');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug,
          status: 'ACTIVE',
          settings: {
            currency,
            timezone,
            vatRate: 0,
            ssclRate: 0,
            receiptFooter: '',
            enabledModules: ['appointments', 'delivery'],
          },
        },
      });

      await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash: ownerPasswordHash,
          role: 'OWNER',
          tenantId: tenant.id,
          permissions: [],
          isActive: true,
        },
      });

      return tenant;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('A business with this slug already exists');
      }
    }
    throw error;
  }
}

export async function updateTenantStatus(
  tenantId: string,
  status: TenantStatus,
  actorId: string,
  extraData?: Prisma.TenantUpdateInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { status, ...extraData },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          actorRole: 'SUPER_ADMIN',
          entityType: 'Tenant',
          entityId: tenantId,
          action: `STATUS_CHANGED_TO_${status}`,
          after: { status },
        },
      });

      return tenant;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('Business not found');
    }
    throw error;
  }
}

export async function suspendTenant(tenantId: string, actorId: string) {
  return updateTenantStatus(tenantId, 'SUSPENDED', actorId, { graceEndsAt: null });
}

export async function reactivateTenant(tenantId: string, actorId: string) {
  return updateTenantStatus(tenantId, 'ACTIVE', actorId, { graceEndsAt: null });
}

export async function getActiveTenantBySlug(slug: string) {
  return prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, status: true },
  });
}
