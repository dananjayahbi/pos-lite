import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import type { TxClient } from '@/lib/services/inventory.service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { ApiError } from '@/lib/api/errors';
import { netSpendAfterVoid } from '@/lib/services/customerSpend.core';
import {
  customerAuditSnapshot,
  type CustomerAuditActor,
} from '@/lib/services/customerAudit.core';

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

/** Actor for customer master-data audit rows (ARGUS #315). */
function writeCustomerAudit(input: {
  tenantId: string;
  actor: CustomerAuditActor | undefined;
  entityId: string;
  action: string;
  before?: ReturnType<typeof customerAuditSnapshot> | undefined;
  after?: ReturnType<typeof customerAuditSnapshot> | undefined;
}): void {
  void createAuditLog({
    tenantId: input.tenantId,
    actorId: input.actor?.id ?? null,
    actorRole: input.actor?.role ?? 'SYSTEM',
    entityType: 'Customer',
    entityId: input.entityId,
    action: input.action,
    ...(input.before !== undefined ? { before: input.before } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
  });
}

/**
 * M05-02 (BUG-26/29) — normalize a birthday input to a valid Date, or
 * undefined when absent/empty/unparseable. The validator already rejects
 * garbage at the boundary; this guard keeps '' or Invalid Date out of Prisma
 * for every caller (POST, PATCH, and direct service use).
 */
function toValidDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Trim an optional text field and collapse blank input to `undefined`. */
function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

// ── Create ───────────────────────────────────────────────────────────────────

interface CreateCustomerData {
  name: string;
  phone: string;
  phone2?: string | undefined;
  email?: string | null | undefined;
  address?: string | undefined;
  city?: string | undefined;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | undefined;
  /** Raw string or validator-parsed Date; null clears it. */
  birthday?: string | Date | null | undefined;
  tags?: string[] | undefined;
  notes?: string | undefined;
}

export async function createCustomer(
  tenantId: string,
  data: CreateCustomerData,
  actor?: CustomerAuditActor,
) {
  // M05-03 (BUG-27 / D4 policy): the phone is RESERVED per tenant while any
  // row carries it — live or soft-deleted — because @@unique([tenantId, phone])
  // keeps archived rows holding the phone. This deletedAt-agnostic pre-check
  // surfaces the friendly 409 on the sequential path (customer self-service
  // restore is deferred to XC-05); the DB unique + mapPrismaError stays the
  // concurrency guarantee — a race loser gets P2002 → 409, never a 500.
  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone: data.phone },
    select: { id: true, deletedAt: true },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.deletedAt
        ? 'A customer with this phone number already exists (an archived record uses this phone)'
        : 'A customer with this phone number already exists',
    );
  }

  // M05-02: only pass birthday when it resolves to a valid Date.
  const birthday = toValidDate(data.birthday);
  const phone2 = optionalText(data.phone2);
  const address = optionalText(data.address);
  const city = optionalText(data.city);

  const created = await prisma.customer.create({
    data: {
      tenantId,
      name: data.name,
      phone: data.phone,
      ...(phone2 !== undefined && { phone2 }),
      ...(data.email !== undefined && { email: data.email }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(birthday !== undefined && birthday !== null && { birthday }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.notes !== undefined && { notes: optionalText(data.notes) ?? null }),
    },
  });

  writeCustomerAudit({
    tenantId,
    actor,
    entityId: created.id,
    action: AUDIT_ACTIONS.CUSTOMER_CREATED,
    after: customerAuditSnapshot(created),
  });

  return created;
}

// ── Update ───────────────────────────────────────────────────────────────────

interface UpdateCustomerData {
  name?: string | undefined;
  phone?: string | undefined;
  phone2?: string | undefined;
  email?: string | null | undefined;
  address?: string | undefined;
  city?: string | undefined;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | undefined;
  /** Raw string or validator-parsed Date; null clears it. */
  birthday?: string | Date | null | undefined;
  tags?: string[] | undefined;
  notes?: string | undefined;
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  data: UpdateCustomerData,
  actor?: CustomerAuditActor,
) {
  const existing = await assertCustomerBelongsToTenant(tenantId, customerId);

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

  // M05-02: only pass birthday when it resolves to a valid Date (PATCH path).
  const birthday = toValidDate(data.birthday);

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      // Explicit empty strings (or null) clear these optional fields on PATCH;
      // omitted keys leave the stored value untouched.
      ...(data.phone2 !== undefined && { phone2: optionalText(data.phone2) ?? null }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: optionalText(data.address) ?? null }),
      ...(data.city !== undefined && { city: optionalText(data.city) ?? null }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.birthday !== undefined && { birthday: birthday ?? null }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.notes !== undefined && { notes: optionalText(data.notes) ?? null }),
    },
  });

  writeCustomerAudit({
    tenantId,
    actor,
    entityId: customerId,
    action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
    before: customerAuditSnapshot(existing),
    after: customerAuditSnapshot(updated),
  });

  return updated;
}

// ── Get by ID ────────────────────────────────────────────────────────────────

export async function getCustomerById(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
    include: {
      _count: { select: { sales: { where: { status: 'COMPLETED' } } } },
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

  // ARGUS #310: returns belong to the customer through the original sale. The
  // customer detail API previously returned none, so the Returns tab could
  // never show a real row.
  const returns = await prisma.return.findMany({
    where: {
      tenantId,
      originalSale: { customerId, tenantId },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      originalSaleId: true,
      refundAmount: true,
      refundMethod: true,
      status: true,
      createdAt: true,
      lines: { select: { quantity: true } },
    },
  });

  return {
    ...customer,
    orderCount: visitCount,
    visitCount,
    avgOrderValue: avgOrderValue.toString(),
    preferredCategories,
    returns,
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
    where: { sale: { tenantId, customerId, status: 'COMPLETED' } },
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
    if (!line.variant) continue;
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
      include: { _count: { select: { sales: { where: { status: 'COMPLETED' } } } } },
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

export async function softDeleteCustomer(
  tenantId: string,
  customerId: string,
  actor?: CustomerAuditActor,
) {
  const existing = await assertCustomerBelongsToTenant(tenantId, customerId);

  const deleted = await prisma.customer.update({
    where: { id: customerId },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  writeCustomerAudit({
    tenantId,
    actor,
    entityId: customerId,
    action: AUDIT_ACTIONS.CUSTOMER_DELETED,
    before: customerAuditSnapshot(existing),
    after: customerAuditSnapshot(deleted),
  });

  return deleted;
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

  // Consume issued credit notes FIFO so `usedAmount` stays truthful and a
  // credit issued by a return can be traced to the sale that spent it.
  const credits = await tx.storeCredit.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: 'asc' },
  });
  let remaining = amount;
  for (const credit of credits) {
    if (remaining.lte(0)) break;
    const available = new Decimal(credit.amount.toString()).minus(
      new Decimal(credit.usedAmount.toString()),
    );
    if (available.lte(0)) continue;
    const consumed = Decimal.min(available, remaining);
    await tx.storeCredit.update({
      where: { id: credit.id },
      data: { usedAmount: { increment: consumed.toNumber() } },
    });
    remaining = remaining.minus(consumed);
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

/**
 * Issue store credit to a customer (e.g. a return refunded as credit).
 *
 * Both the redeemable balance (`Customer.creditBalance`, which the POS reads)
 * and the credit-note ledger row are written together, so the credit can
 * actually be spent and the issuance stays auditable (ARGUS #92).
 */
export async function issueCredit(
  tenantId: string,
  customerId: string,
  amount: Decimal,
  note: string,
  tx: TxClient,
) {
  if (amount.lte(0)) {
    throw new Error('Credit amount must be greater than zero');
  }

  const updated = await tx.customer.update({
    where: { id: customerId },
    data: {
      creditBalance: { increment: amount.toNumber() },
    },
  });

  await tx.storeCredit.create({
    data: {
      tenantId,
      customerId,
      amount: amount.toFixed(2),
      note,
    },
  });

  void createAuditLog({
    tenantId,
    actorId: null,
    actorRole: 'SYSTEM',
    entityType: 'Customer',
    entityId: customerId,
    action: AUDIT_ACTIONS.CUSTOMER_CREDIT_ADJUSTED,
    after: {
      amountIssued: amount.toString(),
      newBalance: updated.creditBalance.toString(),
      note,
    },
  }).catch(() => {});

  return updated;
}

/**
 * Reverse the spend accrued by a sale that is being voided (ARGUS #308).
 *
 * `addToSpendTotal` runs once at sale creation, so without this a void left the
 * customer's lifetime spend (and the loyalty/broadcast segments derived from it)
 * counting money that was never collected. `lastPurchaseAt` is recomputed from
 * the most recent remaining completed sale.
 */
export async function reverseSpendOnVoid(
  tenantId: string,
  customerId: string,
  amount: Decimal,
  voidedSaleId: string,
  tx: TxClient,
) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { totalSpend: true },
  });
  if (!customer) return;

  const nextSpend = netSpendAfterVoid(customer.totalSpend.toString(), amount);
  const lastSale = await tx.sale.findFirst({
    where: { tenantId, customerId, status: 'COMPLETED', id: { not: voidedSaleId } },
    orderBy: { createdAt: 'desc' },
    select: { saleDate: true, createdAt: true },
  });

  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalSpend: nextSpend.toNumber(),
      lastPurchaseAt: lastSale ? (lastSale.saleDate ?? lastSale.createdAt) : null,
    },
  });
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
