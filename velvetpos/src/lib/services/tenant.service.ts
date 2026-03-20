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
  planId: string;
}

interface GetAllTenantsOptions {
  search?: string;
  status?: TenantStatus;
  page?: number;
  limit?: number;
}

// ── Service Functions ────────────────────────────────────────────────────────

export async function getAllTenants(options: GetAllTenantsOptions = {}) {
  const { search, status, page = 1, limit = 20 } = options;

  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    ...(status && { status }),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return { tenants, total };
}

export async function getTenantById(tenantId: string) {
  try {
    return await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        users: { take: 5 },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
        invoices: {
          orderBy: { billingDate: 'desc' },
          take: 10,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('Tenant not found');
    }
    throw error;
  }
}

export async function createTenant(input: CreateTenantInput) {
  const { storeName, slug, ownerEmail, ownerPasswordHash, timezone, currency, planId } = input;

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

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId,
          status: 'TRIALING',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
        },
      });

      return tenant;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('A tenant with this slug already exists');
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
      throw new Error('Tenant not found');
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

export async function triggerGracePeriod(tenantId: string, actorId: string, graceDays = 14) {
  const graceEndsAt = new Date();
  graceEndsAt.setDate(graceEndsAt.getDate() + graceDays);

  return updateTenantStatus(tenantId, 'GRACE_PERIOD', actorId, { graceEndsAt });
}

export async function getActiveTenantBySlug(slug: string) {
  return prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, status: true },
  });
}
