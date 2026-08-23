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

  const preferredCategories = await getPreferredCategories(tenantId, customerId);

  return {
    ...customer,
    orderCount: visitCount,
    visitCount,
    avgOrderValue: avgOrderValue.toString(),
    preferredCategories,
  };
}

// ── Preferred categories (doc 21) ────────────────────────────────────────────

export interface PreferredCategory {
  categoryId: string;
  categoryName: string;
  /** Total quantity purchased across the customer's sales. */
  quantity: number;
  /** Sum of line totals (after discount) across the customer's sales. */
  lineTotal: string;
}

/**
 * Aggregate the customer's sales lines, joined through variant → product →
 * category, and return categories ranked by quantity (top 5). Returns an
 * empty array when the customer has no sale lines or none are categorized.
 */
export async function getPreferredCategories(
  tenantId: string,
  customerId: string,
): Promise<PreferredCategory[]> {
  const lines = await prisma.saleLine.findMany({
    where: { sale: { tenantId, customerId } },
    select: {
      quantity: true,
      lineTotalAfterDiscount: true,
      variant: {
        select: {
          product: {
            select: {
              categoryId: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const byCategory = new Map<string, PreferredCategory>();
  for (const line of lines) {
    const categoryId = line.variant.product.categoryId;
    const categoryName = line.variant.product.category.name;
    const lineTotal = new Decimal(line.lineTotalAfterDiscount.toString());
    const existing = byCategory.get(categoryId);
    if (existing) {
      existing.quantity += line.quantity;
      existing.lineTotal = new Decimal(existing.lineTotal)
        .plus(lineTotal)
        .toFixed(2);
    } else {
      byCategory.set(categoryId, {
        categoryId,
        categoryName,
        quantity: line.quantity,
        lineTotal: lineTotal.toFixed(2),
      });
    }
  }

  return [...byCategory.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

// ── List ─────────────────────────────────────────────────────────────────────

interface GetCustomersOptions {
  search?: string | undefined;
  tag?: string | undefined;
  spendMin?: number | undefined;
  spendMax?: number | undefined;
  /** When true, only include customers with ≥ REPEAT_ORDER_THRESHOLD orders. */
  repeatBuyers?: boolean | undefined;
  /** Alternative to repeatBuyers: explicit minimum order count. */
  minOrders?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

/** Collect customer ids whose sale count meets the minimum (separate query path). */
async function getCustomerIdsWithMinOrders(
  tenantId: string,
  minOrders: number,
): Promise<string[]> {
  const grouped = await prisma.sale.groupBy({
    by: ['customerId'],
    where: { tenantId, customerId: { not: null } },
    _count: { _all: true },
  });
  return grouped
    .filter((g) => g.customerId !== null && g._count._all >= minOrders)
    .map((g) => g.customerId as string);
}

export async function getCustomers(tenantId: string, options: GetCustomersOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const minOrders = options.repeatBuyers
    ? Math.max(options.minOrders ?? 1, 2)
    : (options.minOrders ?? 0);

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

  if (minOrders > 0) {
    const ids = await getCustomerIdsWithMinOrders(tenantId, minOrders);
    andConditions.push({ id: { in: ids } });
  }

  const where = { AND: andConditions };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { _count: { select: { sales: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers: customers.map((c) => ({
      ...c,
      orderCount: c._count.sales,
      _count: undefined,
    })),
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
      lastPurchaseAt: new Date(),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[customer.service] addToSpendTotal: customer=${customerId}, amount=${amount.toString()}, newTotal=${updated.totalSpend}`,
    );
  }

  return updated;
}
