/**
 * Factory output KPIs (ARGUS #261) — production runs, units produced and
 * finished-goods stock/value for one tenant. Tenant-scoped at the query level;
 * the route enforces authentication and `factory:dashboard:view`.
 */
import { prisma } from '@/lib/prisma';
import {
  summarizeFactoryOutput,
  type FactoryOutputStats,
} from '@/lib/factory/factoryOutputStats.core';

export async function getFactoryOutputStats(
  tenantId: string,
  now: Date = new Date(),
): Promise<FactoryOutputStats & { lastProductionAt: Date | null }> {
  const [production, finishedGoods, latestRun] = await Promise.all([
    prisma.productionLog.aggregate({
      where: { tenantId },
      _count: { _all: true },
      _sum: { quantity: true, materialCost: true },
    }),
    prisma.productVariant.findMany({
      where: {
        tenantId,
        deletedAt: null,
        product: { productSource: 'MANUFACTURED', isArchived: false },
      },
      select: { stockQuantity: true, costPrice: true },
    }),
    prisma.productionLog.findFirst({
      where: { tenantId, createdAt: { lte: now } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const stats = summarizeFactoryOutput({
    productionRunCount: production._count._all,
    totalProduced: production._sum.quantity ?? 0,
    totalMaterialCost: production._sum.materialCost?.toNumber() ?? 0,
    finishedGoods: finishedGoods.map((row) => ({
      stockQuantity: row.stockQuantity,
      costPrice: row.costPrice.toNumber(),
    })),
  });

  return { ...stats, lastProductionAt: latestRun?.createdAt ?? null };
}
