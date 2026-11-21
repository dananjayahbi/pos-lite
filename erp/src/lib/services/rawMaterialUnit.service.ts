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
import { ApiError } from '@/lib/api/errors';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  DEFAULT_RAW_MATERIAL_UNITS,
  humanizeUnitKey,
  slugifyRawMaterialCategoryKey,
} from '@/lib/services/rawMaterial.core';
import {
  buildRawMaterialUnitCatalog,
  type RawMaterialUnitCatalog,
} from '@/lib/services/rawMaterialUnitCatalog.core';
import {
  findDuplicateUnitLabel,
  hasAlphanumeric,
  type UnitLabelConflict,
} from '@/lib/units/unitValidation.core';
import { unitDeleteBlock } from '@/lib/units/unitDeleteGuard.core';
import { builtInRowIdsToRevive } from '@/lib/units/unitSeed.core';

export interface RawMaterialUnitItem {
  id: string;
  key: string;
  name: string;
  shortLabel: string;
  isActive: boolean;
  usageCount: number;
  /** Materials that reference the unit but are soft-deleted (ARGUS #483). */
  archivedUsageCount: number;
  /** Seeded default for every tenant; cannot be deactivated or deleted (ARGUS #479/#483). */
  isBuiltIn: boolean;
}

export interface RawMaterialUnitOption {
  key: string;
  name: string;
  shortLabel: string;
}

const DEFAULT_KEYS = new Set<string>(DEFAULT_RAW_MATERIAL_UNITS.map((unit) => unit.key));
const DEFAULT_UNIT_KEYS = DEFAULT_RAW_MATERIAL_UNITS.map((unit) => unit.key);

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

  // ARGUS #483: the unique key is held even by a soft-deleted row, so
  // `skipDuplicates` alone left a deleted built-in gone forever. Revive any
  // built-in row that was soft-deleted; its current (possibly renamed) labels
  // are kept, only the lifecycle flags change.
  const builtInRows = await prisma.rawMaterialUnit.findMany({
    where: { tenantId, key: { in: DEFAULT_UNIT_KEYS } },
    select: { id: true, key: true, deletedAt: true },
  });
  const reviveIds = builtInRowIdsToRevive(builtInRows, DEFAULT_KEYS);
  if (reviveIds.length > 0) {
    await prisma.rawMaterialUnit.updateMany({
      where: { tenantId, id: { in: reviveIds } },
      data: { deletedAt: null, isActive: true },
    });
  }
}

interface UnitUsage {
  live: number;
  archived: number;
}

function toItem(
  row: { id: string; key: string; name: string; shortLabel: string; isActive: boolean },
  usage: UnitUsage,
): RawMaterialUnitItem {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    shortLabel: row.shortLabel,
    isActive: row.isActive,
    usageCount: usage.live,
    archivedUsageCount: usage.archived,
    isBuiltIn: DEFAULT_KEYS.has(row.key),
  };
}

async function usageByKey(tenantId: string): Promise<Map<string, UnitUsage>> {
  const [live, archived] = await Promise.all([
    prisma.rawMaterial.groupBy({
      by: ['unit'],
      where: { tenantId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.rawMaterial.groupBy({
      by: ['unit'],
      where: { tenantId, deletedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, UnitUsage>();
  const bump = (rows: typeof live, key: 'live' | 'archived') => {
    for (const row of rows) {
      const current = counts.get(row.unit) ?? { live: 0, archived: 0 };
      current[key] = row._count._all;
      counts.set(row.unit, current);
    }
  };
  bump(live, 'live');
  bump(archived, 'archived');
  return counts;
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

  return rows.map((row) => toItem(row, usage.get(row.key) ?? { live: 0, archived: 0 }));
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
  const catalog = await listRawMaterialUnitCatalog(tenantId);
  return new Map(
    [...catalog.values()].map((unit) => [
      unit.key,
      { key: unit.key, name: unit.name, shortLabel: unit.shortLabel },
    ]),
  );
}

/**
 * Tenant unit catalog for label resolution (ARGUS #481).
 *
 * Includes inactive and soft-deleted rows so a material (or historical log)
 * that still references a key keeps its tenant-defined label instead of
 * falling back to the raw key. Selection inputs must keep using
 * `listRawMaterialUnitOptions`, which filters to active rows.
 */
export async function listRawMaterialUnitCatalog(
  tenantId: string,
): Promise<RawMaterialUnitCatalog> {
  await ensureDefaultRawMaterialUnits(tenantId);
  const rows = await prisma.rawMaterialUnit.findMany({
    where: { tenantId },
    select: { key: true, name: true, shortLabel: true, isActive: true, deletedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return buildRawMaterialUnitCatalog(rows);
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

function unitDuplicateError(conflict: UnitLabelConflict): ApiError {
  return conflict.field === 'name'
    ? ApiError.conflict(`A unit named "${conflict.existingName}" already exists.`)
    : ApiError.conflict(
        `That short label is already used by "${conflict.existingName}".`,
      );
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
  // ARGUS #482: a name with no letters/digits used to collapse to the hidden
  // key "CATEGORY"; reject it instead of creating a meaningless unit.
  if (!hasAlphanumeric(name)) {
    throw ApiError.validation(
      'Unit name must include at least one letter or number.',
    );
  }

  const existingRows = await prisma.rawMaterialUnit.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true, shortLabel: true },
  });
  const duplicate = findDuplicateUnitLabel(
    { name, shortLabel: input.shortLabel?.trim() || undefined },
    existingRows,
  );
  if (duplicate) {
    throw unitDuplicateError(duplicate);
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

  return toItem(row, { live: 0, archived: 0 });
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

  // ARGUS #480: a rename changes display labels only. The stable `key` on raw
  // materials and BOM lines is never rewritten and quantities are not
  // converted; the UI requires an explicit acknowledgement before sending one.
  const name = input.name !== undefined ? input.name.trim() : undefined;
  const shortLabel = input.shortLabel !== undefined ? input.shortLabel.trim() : undefined;
  if (name !== undefined && !name) {
    throw new Error('VALIDATION_ERROR');
  }
  if (name !== undefined && !hasAlphanumeric(name)) {
    throw ApiError.validation(
      'Unit name must include at least one letter or number.',
    );
  }
  if (shortLabel !== undefined && !shortLabel) {
    throw new Error('VALIDATION_ERROR');
  }

  // ARGUS #482: names/short labels are unique per tenant after normalisation,
  // so the material selector and quantity suffix cannot show two "Kilograms"
  // or two "kg" rows. The unit being edited is excluded.
  if (name !== undefined || shortLabel !== undefined) {
    const rows = await prisma.rawMaterialUnit.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, shortLabel: true },
    });
    const duplicate = findDuplicateUnitLabel(
      { name, shortLabel },
      rows,
      existing.id,
    );
    if (duplicate) {
      throw unitDuplicateError(duplicate);
    }
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
    before: { key: existing.key, name: existing.name, shortLabel: existing.shortLabel, isActive: existing.isActive },
    after: { key: row.key, name: row.name, shortLabel: row.shortLabel, isActive: row.isActive },
  }).catch(() => {});

  const usage = await usageByKey(tenantId);
  return toItem(row, usage.get(row.key) ?? { live: 0, archived: 0 });
}

export async function deleteRawMaterialUnit(
  tenantId: string,
  actorId: string,
  id: string,
): Promise<void> {
  const existing = await findOwnedUnit(tenantId, id);

  const liveUsage = await prisma.rawMaterial.count({
    where: { tenantId, unit: existing.key, deletedAt: null },
  });
  const remaining = await prisma.rawMaterialUnit.count({
    where: { tenantId, id: { not: id }, deletedAt: null },
  });
  // ARGUS #485: one tested decision covers the three guards and their order.
  const blocked = unitDeleteBlock({
    isBuiltIn: DEFAULT_KEYS.has(existing.key),
    liveUsage,
    remainingLiveUnits: remaining,
  });
  if (blocked) {
    throw new Error(blocked);
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
