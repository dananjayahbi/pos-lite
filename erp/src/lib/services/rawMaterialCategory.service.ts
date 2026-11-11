/**
 * Raw-material category service.
 *
 * Categories are tenant-managed so factories can add things like
 * "Bottles & Caps" without a schema change. The three built-in categories are
 * seeded lazily for every tenant and can be renamed, deactivated or deleted
 * (as long as they are not in use).
 */
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  DEFAULT_RAW_MATERIAL_CATEGORIES,
  slugifyRawMaterialCategoryKey,
} from '@/lib/services/rawMaterial.core';

export interface RawMaterialCategoryItem {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  usageCount: number;
}

export interface RawMaterialCategoryOption {
  key: string;
  name: string;
}

const DEFAULT_KEYS = new Set<string>(DEFAULT_RAW_MATERIAL_CATEGORIES.map((c) => c.key));

/**
 * Make sure every tenant has the built-in categories. Idempotent and safe to
 * call on every list/create request.
 */
export async function ensureDefaultRawMaterialCategories(tenantId: string): Promise<void> {
  await prisma.rawMaterialCategoryOption.createMany({
    data: DEFAULT_RAW_MATERIAL_CATEGORIES.map((category) => ({
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
): RawMaterialCategoryItem {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isActive: row.isActive,
    usageCount,
  };
}

async function usageByKey(tenantId: string): Promise<Map<string, number>> {
  const grouped = await prisma.rawMaterial.groupBy({
    by: ['category'],
    where: { tenantId, deletedAt: null },
    _count: { _all: true },
  });
  return new Map(grouped.map((row) => [row.category, row._count._all]));
}

export async function listRawMaterialCategories(
  tenantId: string,
): Promise<RawMaterialCategoryItem[]> {
  await ensureDefaultRawMaterialCategories(tenantId);

  const [rows, usage] = await Promise.all([
    prisma.rawMaterialCategoryOption.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    }),
    usageByKey(tenantId),
  ]);

  return rows.map((row) => toItem(row, usage.get(row.key) ?? 0));
}

/** Active categories shaped for select inputs and label lookups. */
export async function listRawMaterialCategoryOptions(
  tenantId: string,
): Promise<RawMaterialCategoryOption[]> {
  const categories = await listRawMaterialCategories(tenantId);
  return categories
    .filter((category) => category.isActive)
    .map(({ key, name }) => ({ key, name }));
}

export async function getRawMaterialCategoryNameMap(
  tenantId: string,
): Promise<Map<string, string>> {
  const options = await listRawMaterialCategoryOptions(tenantId);
  return new Map(options.map((option) => [option.key, option.name]));
}

/** Throws `CATEGORY_NOT_FOUND` when the key does not exist for the tenant. */
export async function assertRawMaterialCategoryExists(
  tenantId: string,
  key: string,
): Promise<void> {
  await ensureDefaultRawMaterialCategories(tenantId);
  const found = await prisma.rawMaterialCategoryOption.findFirst({
    where: { tenantId, key, deletedAt: null },
    select: { id: true },
  });
  if (!found) {
    throw new Error('CATEGORY_NOT_FOUND');
  }
}

async function nextAvailableKey(tenantId: string, base: string): Promise<string> {
  const existing = await prisma.rawMaterialCategoryOption.findMany({
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

export async function createRawMaterialCategory(
  tenantId: string,
  actorId: string,
  input: { name: string },
): Promise<RawMaterialCategoryItem> {
  await ensureDefaultRawMaterialCategories(tenantId);
  const name = input.name.trim();
  if (!name) {
    throw new Error('VALIDATION_ERROR');
  }

  const key = await nextAvailableKey(tenantId, slugifyRawMaterialCategoryKey(name));

  // Re-use a previously soft-deleted category when the key matches so history
  // and material references stay intact.
  const deleted = await prisma.rawMaterialCategoryOption.findFirst({
    where: { tenantId, key, deletedAt: { not: null } },
  });
  const row = deleted
    ? await prisma.rawMaterialCategoryOption.update({
        where: { id: deleted.id },
        data: { name, isActive: true, deletedAt: null },
      })
    : await prisma.rawMaterialCategoryOption.create({
        data: { tenantId, key, name },
      });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'RawMaterialCategory',
    entityId: row.id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_CATEGORY_CREATED,
    after: { key: row.key, name: row.name },
  }).catch(() => {});

  return toItem(row, 0);
}

async function findOwnedCategory(tenantId: string, id: string) {
  const row = await prisma.rawMaterialCategoryOption.findUnique({ where: { id } });
  if (!row || row.deletedAt) {
    throw new Error('NOT_FOUND');
  }
  if (row.tenantId !== tenantId) {
    throw new Error('FORBIDDEN');
  }
  return row;
}

export async function updateRawMaterialCategory(
  tenantId: string,
  actorId: string,
  id: string,
  input: { name?: string | undefined; isActive?: boolean | undefined },
): Promise<RawMaterialCategoryItem> {
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

  const row = await prisma.rawMaterialCategoryOption.update({
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
    entityType: 'RawMaterialCategory',
    entityId: id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_CATEGORY_UPDATED,
    before: { name: existing.name, isActive: existing.isActive },
    after: { name: row.name, isActive: row.isActive },
  }).catch(() => {});

  const usage = await prisma.rawMaterial.count({
    where: { tenantId, category: row.key, deletedAt: null },
  });
  return toItem(row, usage);
}

export async function deleteRawMaterialCategory(
  tenantId: string,
  actorId: string,
  id: string,
): Promise<void> {
  const existing = await findOwnedCategory(tenantId, id);

  const usage = await prisma.rawMaterial.count({
    where: { tenantId, category: existing.key, deletedAt: null },
  });
  if (usage > 0) {
    throw new Error('CATEGORY_IN_USE');
  }

  const remaining = await prisma.rawMaterialCategoryOption.count({
    where: { tenantId, id: { not: id }, deletedAt: null },
  });
  if (remaining === 0) {
    throw new Error('LAST_CATEGORY');
  }

  await prisma.rawMaterialCategoryOption.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'RawMaterialCategory',
    entityId: id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_CATEGORY_DELETED,
    before: { key: existing.key, name: existing.name },
  }).catch(() => {});
}
