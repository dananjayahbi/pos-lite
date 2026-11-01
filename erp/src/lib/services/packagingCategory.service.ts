/**
 * Packaging category service.
 *
 * Categories are tenant-managed so a shop can add things like "Courier Bags"
 * without a schema change. The five built-in categories are seeded lazily for
 * every tenant and can be renamed or retired (as long as they are not in use).
 */
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  DEFAULT_PACKAGING_CATEGORIES,
  slugifyPackagingCategoryKey,
} from '@/lib/constants/packaging';

export interface PackagingCategoryItem {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  usageCount: number;
}

export interface PackagingCategoryOption {
  key: string;
  name: string;
}

const DEFAULT_KEYS = new Set<string>(DEFAULT_PACKAGING_CATEGORIES.map((c) => c.key));

/**
 * Make sure every tenant has the built-in categories. Idempotent and safe to
 * call on every list/create request.
 */
export async function ensureDefaultPackagingCategories(tenantId: string): Promise<void> {
  await prisma.packagingCategoryOption.createMany({
    data: DEFAULT_PACKAGING_CATEGORIES.map((category) => ({
      tenantId,
      key: category.key,
      name: category.name,
    })),
    skipDuplicates: true,
  });
}

function toItem(
  row: { id: string; key: string; name: string; isActive: boolean },
  usageCount: number,
): PackagingCategoryItem {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isActive: row.isActive,
    usageCount,
  };
}

async function usageByKey(tenantId: string): Promise<Map<string, number>> {
  const grouped = await prisma.packagingItem.groupBy({
    by: ['category'],
    where: { tenantId, deletedAt: null },
    _count: { _all: true },
  });
  return new Map(grouped.map((row) => [row.category, row._count._all]));
}

export async function listPackagingCategories(tenantId: string): Promise<PackagingCategoryItem[]> {
  await ensureDefaultPackagingCategories(tenantId);

  const [rows, usage] = await Promise.all([
    prisma.packagingCategoryOption.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    }),
    usageByKey(tenantId),
  ]);

  return rows.map((row) => toItem(row, usage.get(row.key) ?? 0));
}

/** Active categories shaped for select inputs and label lookups. */
export async function listPackagingCategoryOptions(
  tenantId: string,
): Promise<PackagingCategoryOption[]> {
  const categories = await listPackagingCategories(tenantId);
  return categories.filter((category) => category.isActive).map(({ key, name }) => ({ key, name }));
}

export async function getPackagingCategoryNameMap(tenantId: string): Promise<Map<string, string>> {
  const options = await listPackagingCategoryOptions(tenantId);
  return new Map(options.map((option) => [option.key, option.name]));
}

/** Throws `CATEGORY_NOT_FOUND` when the key does not exist for the tenant. */
export async function assertPackagingCategoryExists(tenantId: string, key: string): Promise<void> {
  await ensureDefaultPackagingCategories(tenantId);
  const found = await prisma.packagingCategoryOption.findFirst({
    where: { tenantId, key, deletedAt: null },
    select: { id: true },
  });
  if (!found) {
    throw new Error('CATEGORY_NOT_FOUND');
  }
}

async function nextAvailableKey(tenantId: string, base: string): Promise<string> {
  const existing = await prisma.packagingCategoryOption.findMany({
    where: {
      tenantId,
      OR: [{ key: base }, { key: { startsWith: `${base}_` } }],
    },
    select: { key: true },
  });
  const taken = new Set(existing.map((row) => row.key));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export async function createPackagingCategory(
  tenantId: string,
  actorId: string,
  input: { name: string },
): Promise<PackagingCategoryItem> {
  await ensureDefaultPackagingCategories(tenantId);
  const name = input.name.trim();
  if (!name) {
    throw new Error('VALIDATION_ERROR');
  }

  const key = await nextAvailableKey(tenantId, slugifyPackagingCategoryKey(name));

  // Re-use a previously soft-deleted category when the key matches so history
  // and item references stay intact.
  const deleted = await prisma.packagingCategoryOption.findFirst({
    where: { tenantId, key, deletedAt: { not: null } },
  });
  const row = deleted
    ? await prisma.packagingCategoryOption.update({
        where: { id: deleted.id },
        data: { name, isActive: true, deletedAt: null },
      })
    : await prisma.packagingCategoryOption.create({
        data: { tenantId, key, name },
      });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'PackagingCategory',
    entityId: row.id,
    action: AUDIT_ACTIONS.PACKAGING_CATEGORY_CREATED,
    after: { key: row.key, name: row.name },
  }).catch(() => {});

  return toItem(row, 0);
}

async function findOwnedCategory(tenantId: string, id: string) {
  const row = await prisma.packagingCategoryOption.findUnique({ where: { id } });
  if (!row || row.deletedAt) {
    throw new Error('NOT_FOUND');
  }
  if (row.tenantId !== tenantId) {
    throw new Error('FORBIDDEN');
  }
  return row;
}

export async function updatePackagingCategory(
  tenantId: string,
  actorId: string,
  id: string,
  input: { name?: string | undefined; isActive?: boolean | undefined },
): Promise<PackagingCategoryItem> {
  const existing = await findOwnedCategory(tenantId, id);

  const name = input.name !== undefined ? input.name.trim() : undefined;
  if (name !== undefined && !name) {
    throw new Error('VALIDATION_ERROR');
  }
  if (input.isActive === false && DEFAULT_KEYS.has(existing.key)) {
    // Built-ins can be renamed but not deactivated, otherwise brand-new
    // tenants lose their default choice set.
    throw new Error('BUILT_IN_CATEGORY');
  }

  const row = await prisma.packagingCategoryOption.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'PackagingCategory',
    entityId: id,
    action: AUDIT_ACTIONS.PACKAGING_CATEGORY_UPDATED,
    before: { name: existing.name, isActive: existing.isActive },
    after: { name: row.name, isActive: row.isActive },
  }).catch(() => {});

  const usage = await prisma.packagingItem.count({
    where: { tenantId, category: row.key, deletedAt: null },
  });
  return toItem(row, usage);
}

export async function deletePackagingCategory(
  tenantId: string,
  actorId: string,
  id: string,
): Promise<void> {
  const existing = await findOwnedCategory(tenantId, id);

  const usage = await prisma.packagingItem.count({
    where: { tenantId, category: existing.key, deletedAt: null },
  });
  if (usage > 0) {
    throw new Error('CATEGORY_IN_USE');
  }

  const remaining = await prisma.packagingCategoryOption.count({
    where: { tenantId, id: { not: id }, deletedAt: null },
  });
  if (remaining === 0) {
    throw new Error('LAST_CATEGORY');
  }

  await prisma.packagingCategoryOption.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'PackagingCategory',
    entityId: id,
    action: AUDIT_ACTIONS.PACKAGING_CATEGORY_DELETED,
    before: { key: existing.key, name: existing.name },
  }).catch(() => {});
}
