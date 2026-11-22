import { prisma } from '@/lib/prisma';
import {
  EMPTY_COMPLETED_SPEND,
  type CompletedSpend,
} from '@/lib/services/customerSpend.core';

/**
 * Real spend per customer, derived from COMPLETED sales (ARGUS #309).
 *
 * `Customer.totalSpend`, `lastPurchaseAt` and the `_count.sales` relation are
 * denormalised and include voided/held/seed values, so marketing segments and
 * the contact export read this instead.
 */
export async function getCompletedSpendByCustomer(
  tenantId: string,
  customerIds?: string[],
): Promise<Map<string, CompletedSpend>> {
  const grouped = await prisma.sale.groupBy({
    by: ['customerId'],
    where: {
      tenantId,
      status: 'COMPLETED',
      completedAt: { not: null },
      customerId: customerIds
        ? { in: customerIds }
        : { not: null },
    },
    _sum: { totalAmount: true },
    _count: { _all: true },
    _max: { completedAt: true },
  });

  const result = new Map<string, CompletedSpend>();
  for (const row of grouped) {
    if (!row.customerId) continue;
    result.set(row.customerId, {
      totalSpend: Number(row._sum.totalAmount ?? 0),
      orderCount: row._count._all,
      lastPurchaseAt: row._max.completedAt ?? null,
    });
  }
  return result;
}

export function completedSpendFor(
  spendByCustomer: Map<string, CompletedSpend>,
  customerId: string,
): CompletedSpend {
  return spendByCustomer.get(customerId) ?? EMPTY_COMPLETED_SPEND;
}
