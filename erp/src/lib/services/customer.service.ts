import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import type { TxClient } from '@/lib/services/inventory.service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

// ── Private Helpers ──────────────────────────────────────────────────────────

async function assertCustomerBelongsToTenant(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
  });
  if (!customer) {
    throw new Error('Customer not found');
  }
  return customer;
}

// ── Create ───────────────────────────────────────────────────────────────────

interface CreateCustomerData {
  name: string;
  phone: string;
  email?: string | undefined;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | undefined;
  birthday?: string | undefined;
  tags?: string[] | undefined;
  notes?: string | undefined;
}

export async function createCustomer(tenantId: string, data: CreateCustomerData) {
  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: data.phone, deletedAt: null },
  });
  if (existing) {
    throw new Error('A customer with this phone number already exists');
  }

  return prisma.customer.create({
    data: {
      tenantId,
      name: data.name,
      phone: data.phone,
      ...(data.email !== undefined && { email: data.email }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.birthday !== undefined && { birthday: new Date(data.birthday) }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

// ── Update ───────────────────────────────────────────────────────────────────

interface UpdateCustomerData {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | undefined;
  birthday?: string | undefined;
  tags?: string[] | undefined;
  notes?: string | undefined;
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  data: UpdateCustomerData,
) {
  await assertCustomerBelongsToTenant(tenantId, customerId);

  if (data.phone !== undefined) {
    const existing = await prisma.customer.findFirst({
      where: {
        tenantId,
        phone: data.phone,
        deletedAt: null,
        id: { not: customerId },
      },
    });
    if (existing) {
      throw new Error('A customer with this phone number already exists');
    }
  }

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.birthday !== undefined && { birthday: new Date(data.birthday) }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

// ── Get by ID ────────────────────────────────────────────────────────────────

export async function getCustomerById(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
    include: {
      _count: { select: { sales: true } },
      sales: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: true,
          payments: true,
        },
      },
    },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const visitCount = customer._count.sales;
  const totalSpend = new Decimal(customer.totalSpend.toString());
  const avgOrderValue = visitCount > 0
    ? totalSpend.div(visitCount).toDecimalPlaces(2)
    : new Decimal(0);

  return {
    ...customer,
    visitCount,
    avgOrderValue: avgOrderValue.toString(),
  };
}

// ── List ─────────────────────────────────────────────────────────────────────

interface GetCustomersOptions {
  search?: string | undefined;
  tag?: string | undefined;
  spendMin?: number | undefined;
  spendMax?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export async function getCustomers(tenantId: string, options: GetCustomersOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const andConditions: Record<string, unknown>[] = [
    { tenantId },
    { deletedAt: null },
  ];

  if (options.search !== undefined && options.search.length > 0) {
    andConditions.push({
      OR: [
        { name: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search, mode: 'insensitive' } },
      ],
    });
  }

  if (options.tag !== undefined && options.tag.length > 0) {
    andConditions.push({ tags: { hasSome: [options.tag] } });
  }

  if (options.spendMin !== undefined) {
    andConditions.push({ totalSpend: { gte: options.spendMin } });
  }

  if (options.spendMax !== undefined) {
    andConditions.push({ totalSpend: { lte: options.spendMax } });
  }

  const where = { AND: andConditions };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Soft Delete ──────────────────────────────────────────────────────────────

export async function softDeleteCustomer(tenantId: string, customerId: string) {
  await assertCustomerBelongsToTenant(tenantId, customerId);

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });
}

// ── Credit Operations ────────────────────────────────────────────────────────

export async function applyCreditToCart(
  tenantId: string,
  customerId: string,
  requestedAmount: Decimal,
) {
  const customer = await assertCustomerBelongsToTenant(tenantId, customerId);
  const currentBalance = new Decimal(customer.creditBalance.toString());

  const validAmount = currentBalance.gt(0)
    ? Decimal.min(requestedAmount, currentBalance)
    : new Decimal(0);

  return {
    validAmount,
    currentBalance,
  };
}

export async function redeemCredit(
  tenantId: string,
  customerId: string,
  amount: Decimal,
  tx: TxClient,
) {
  if (amount.lte(0)) {
    throw new Error('Redeem amount must be greater than zero');
  }

  const updated = await tx.customer.update({
    where: { id: customerId },
    data: {
      creditBalance: { decrement: amount.toNumber() },
    },
  });

  void createAuditLog({
    tenantId,
    actorId: null,
    actorRole: 'SYSTEM',
    entityType: 'Customer',
    entityId: customerId,
    action: AUDIT_ACTIONS.CUSTOMER_CREDIT_ADJUSTED,
    after: { amountRedeemed: amount.toString(), newBalance: updated.creditBalance.toString() },
  }).catch(() => {});

  return updated;
}

// ── Spend Tracking ───────────────────────────────────────────────────────────

export async function addToSpendTotal(
  tenantId: string,
  customerId: string,
  amount: Decimal,
  tx?: TxClient | undefined,
) {
  const client = tx ?? prisma;

  const updated = await client.customer.update({
    where: { id: customerId },
    data: {
      totalSpend: { increment: amount.toNumber() },
    },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[customer.service] addToSpendTotal: customer=${customerId}, amount=${amount.toString()}, newTotal=${updated.totalSpend}`,
    );
  }

  return updated;
}
