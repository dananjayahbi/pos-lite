/**
 * Raw-material unit service.
 *
 * Units used to be a closed Prisma enum. They are now tenant-managed rows so a
 * factory can add "Bottles", "Caps", "Sachets", etc. without a schema change.
 * The three built-in units are seeded lazily for every tenant and can be
 * renamed, deactivated or deleted (as long as they are not in use).
 *
 * The same catalog is intentionally used everywhere a raw material unit is
 * displayed, so a rename immediately applies to the list, BOM and alerts.
 */
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  DEFAULT_RAW_MATERIAL_UNITS,
  humanizeUnitKey,
  slugifyRawMaterialCategoryKey,
} from '@/lib/services/rawMaterial.core';

export interface RawMaterialUnitItem {
  id: string;
  key: string;
  name: string;
  shortLabel: string;
  isActive: boolean;
  usageCount: number;
}

export interface RawMaterialUnitOption {
  key: string;
  name: string;
  shortLabel: string;
}

const DEFAULT_KEYS = new Set<string>(DEFAULT_RAW_MATERIAL_UNITS.map((unit) => unit.key));

/** Make sure every tenant has the built-in units. Idempotent. */
export async function ensureDefaultRawMaterialUnits(tenantId: string): Promise<void> {
  await prisma.rawMaterialUnit.createMany({
    data: DEFAULT_RAW_MATERIAL_UNITS.map((unit) => ({
      tenantId,
      key: unit.key,
      name: unit.name,
      shortLabel: unit.shortLabel,
    })),
    skipDuplicates: true,
  });
}

function toItem(
  row: { id: string; key: string; name: string; shortLabel: string; isActive: boolean },
  usageCount: number,
): RawMaterialUnitItem {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    shortLabel: row.shortLabel,
    isActive: row.isActive,
    usageCount,
  };
}

async function usageByKey(tenantId: string): Promise<Map<string, number>> {
  const grouped = await prisma.rawMaterial.groupBy({
    by: ['unit'],
    where: { tenantId, deletedAt: null },
    _count: { _all: true },
  });
  return new Map(grouped.map((row) => [row.unit, row._count._all]));
}

export async function listRawMaterialUnits(tenantId: string): Promise<RawMaterialUnitItem[]> {
  await ensureDefaultRawMaterialUnits(tenantId);

  const [rows, usage] = await Promise.all([
    prisma.rawMaterialUnit.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    }),
    usageByKey(tenantId),
  ]);

  return rows.map((row) => toItem(row, usage.get(row.key) ?? 0));
}

/** Active units shaped for select inputs and label lookups. */
export async function listRawMaterialUnitOptions(
  tenantId: string,
): Promise<RawMaterialUnitOption[]> {
  const units = await listRawMaterialUnits(tenantId);
  return units
    .filter((unit) => unit.isActive)
    .map(({ key, name, shortLabel }) => ({ key, name, shortLabel }));
}

export async function getRawMaterialUnitMap(
  tenantId: string,
): Promise<Map<string, RawMaterialUnitOption>> {
  const options = await listRawMaterialUnitOptions(tenantId);
  return new Map(options.map((option) => [option.key, option]));
}

/** Throws `UNIT_NOT_FOUND` when the key does not exist for the tenant. */
export async function assertRawMaterialUnitExists(
  tenantId: string,
  key: string,
): Promise<void> {
  await ensureDefaultRawMaterialUnits(tenantId);
  const found = await prisma.rawMaterialUnit.findFirst({
    where: { tenantId, key, deletedAt: null },
    select: { id: true },
  });
  if (!found) {
    throw new Error('UNIT_NOT_FOUND');
  }
}

async function nextAvailableKey(tenantId: string, base: string): Promise<string> {
  const existing = await prisma.rawMaterialUnit.findMany({
    where: {
      tenantId,
      deletedAt: null,
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

export async function createRawMaterialUnit(
  tenantId: string,
  actorId: string,
  input: { name: string; shortLabel?: string | undefined },
): Promise<RawMaterialUnitItem> {
  await ensureDefaultRawMaterialUnits(tenantId);
  const name = input.name.trim();
  if (!name) {
    throw new Error('VALIDATION_ERROR');
  }

  const key = await nextAvailableKey(tenantId, slugifyRawMaterialCategoryKey(name));
  // A short label is optional in the API. When omitted, derive something
  // readable instead of showing a bare key in the quantity column.
  const shortLabel = input.shortLabel?.trim() || humanizeUnitKey(key).slice(0, 12);

  // Re-use a previously soft-deleted unit when the key matches so history and
  // material references stay intact.
  const deleted = await prisma.rawMaterialUnit.findFirst({
    where: { tenantId, key, deletedAt: { not: null } },
  });
  const row = deleted
    ? await prisma.rawMaterialUnit.update({
        where: { id: deleted.id },
        data: { name, shortLabel, isActive: true, deletedAt: null },
      })
    : await prisma.rawMaterialUnit.create({
        data: { tenantId, key, name, shortLabel },
      });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'RawMaterialUnit',
    entityId: row.id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_UNIT_CREATED,
    after: { key: row.key, name: row.name, shortLabel: row.shortLabel },
  }).catch(() => {});

  return toItem(row, 0);
}

async function findOwnedUnit(tenantId: string, id: string) {
  const row = await prisma.rawMaterialUnit.findUnique({ where: { id } });
  if (!row || row.deletedAt) {
    throw new Error('NOT_FOUND');
  }
  if (row.tenantId !== tenantId) {
    throw new Error('FORBIDDEN');
  }
  return row;
}

export async function updateRawMaterialUnit(
  tenantId: string,
  actorId: string,
  id: string,
  input: { name?: string | undefined; shortLabel?: string | undefined; isActive?: boolean | undefined },
): Promise<RawMaterialUnitItem> {
  const existing = await findOwnedUnit(tenantId, id);

  const name = input.name !== undefined ? input.name.trim() : undefined;
  const shortLabel = input.shortLabel !== undefined ? input.shortLabel.trim() : undefined;
  if (name !== undefined && !name) {
    throw new Error('VALIDATION_ERROR');
  }
  if (shortLabel !== undefined && !shortLabel) {
    throw new Error('VALIDATION_ERROR');
  }
  if (input.isActive === false && DEFAULT_KEYS.has(existing.key)) {
    // Built-ins can be renamed but not deactivated, otherwise brand-new
    // tenants lose their default choice set.
    throw new Error('BUILT_IN_UNIT');
  }

  const row = await prisma.rawMaterialUnit.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(shortLabel !== undefined ? { shortLabel } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'RawMaterialUnit',
    entityId: id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_UNIT_UPDATED,
    before: { name: existing.name, shortLabel: existing.shortLabel, isActive: existing.isActive },
    after: { name: row.name, shortLabel: row.shortLabel, isActive: row.isActive },
  }).catch(() => {});

  const usage = await prisma.rawMaterial.count({
    where: { tenantId, unit: row.key, deletedAt: null },
  });
  return toItem(row, usage);
}

export async function deleteRawMaterialUnit(
  tenantId: string,
  actorId: string,
  id: string,
): Promise<void> {
  const existing = await findOwnedUnit(tenantId, id);

  const usage = await prisma.rawMaterial.count({
    where: { tenantId, unit: existing.key, deletedAt: null },
  });
  if (usage > 0) {
    throw new Error('UNIT_IN_USE');
  }

  const remaining = await prisma.rawMaterialUnit.count({
    where: { tenantId, id: { not: id }, deletedAt: null },
  });
  if (remaining === 0) {
    throw new Error('LAST_UNIT');
  }

  await prisma.rawMaterialUnit.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'RawMaterialUnit',
    entityId: id,
    action: AUDIT_ACTIONS.RAW_MATERIAL_UNIT_DELETED,
    before: { key: existing.key, name: existing.name, shortLabel: existing.shortLabel },
  }).catch(() => {});
}
