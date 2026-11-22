import { prisma } from '@/lib/prisma';
import { UserRole } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { writeAuditLog, writeAuditLogTx, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { mapPrismaError } from '@/lib/api/map-prisma-error';
import { withUniqueGuard } from '@/lib/api/race-guard';
import { ApiError } from '@/lib/api/errors';
import {
  permissionPayloadToSave,
  samePermissionSet,
} from '@/lib/services/permissionSet.core';
import {
  assertLastOwnerRemains,
  assertPermissionsGrantable,
  canAssignRole,
  canManageStaffRole,
  canResetStaffPassword,
} from '@/lib/auth/staff-authorization';
import {
  STAFF_CREATED_AUDIT_FIELDS,
  STAFF_PROFILE_AUDIT_FIELDS,
  buildStaffAuditSnapshot,
  diffStaffAuditFields,
  formatCommissionRateForAudit,
} from '@/lib/services/staffAudit.core';
import { toStaffDetailDto } from '@/lib/services/staffPrivacy.core';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * M03-02 (BUG-4): the acting user, threaded from the route's session so
 * security audits record WHO changed WHAT. 'SYSTEM' is reserved for
 * genuinely system-originated writes (cron) — none of these are.
 */
export interface AuditActor {
  id: string;
  role: string;
  tenantId: string | null;
}

interface GetStaffOptions {
  search?: string | undefined;
  role?: UserRole | undefined;
}

interface StaffProfileFields {
  fullName?: string | undefined;
  nic?: string | undefined;
  contactNumber?: string | undefined;
  address?: string | undefined;
  basicSalary?: string | undefined;
  allowances?: string | undefined;
  bankName?: string | undefined;
  bankBranch?: string | undefined;
  bankAccountNumber?: string | undefined;
  etfNumber?: string | undefined;
  epfNumber?: string | undefined;
}

interface CreateStaffInput extends StaffProfileFields {
  email: string;
  role: UserRole;
  commissionRate?: string | undefined;
}

interface UpdateStaffInput extends StaffProfileFields {
  email?: string | undefined;
  role?: UserRole | undefined;
  isActive?: boolean | undefined;
  commissionRate?: string | undefined;
  permissions?: string[] | undefined;
}

const STAFF_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  permissions: true,
  commissionRate: true,
  clockedInAt: true,
  lastLoginAt: true,
  createdAt: true,
  fullName: true,
  nic: true,
  contactNumber: true,
  address: true,
  basicSalary: true,
  allowances: true,
  bankName: true,
  bankBranch: true,
  bankAccountNumber: true,
  etfNumber: true,
  epfNumber: true,
} as const;

/**
 * ARGUS #341: the list only renders directory fields. Selecting the narrower
 * shape here means salary, bank and HR PII never leave the database for a
 * `staff:view` caller, even if a future response shaper regresses.
 */
const STAFF_LIST_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  // ARGUS #464/#466: the settings roster must be able to name the explicit
  // extras and revokes it shows; permissions are access metadata, not HR PII.
  permissions: true,
  commissionRate: true,
  clockedInAt: true,
  createdAt: true,
  fullName: true,
  contactNumber: true,
} as const;

function cleanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseOptionalDecimal(value: string | undefined): number | undefined {
  const clean = cleanOptional(value);
  if (clean === undefined) return undefined;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// ── Private Helpers ──────────────────────────────────────────────────────────

async function assertStaffBelongsToTenant(tenantId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, tenantId },
  });
  if (!user) {
    // Sentinel token — map-service-error routes it to 404 NOT_FOUND.
    throw new ApiError(404, 'NOT_FOUND', 'Staff member not found');
  }
  return user;
}

// ── Get Staff Members ────────────────────────────────────────────────────────

export async function getStaffMembers(tenantId: string, options?: GetStaffOptions) {
  const where: Record<string, unknown> = {
    tenantId,
    role: { not: UserRole.SUPER_ADMIN },
    deletedAt: null,
  };

  if (options?.search) {
    where.OR = [
      { email: { contains: options.search, mode: 'insensitive' } },
      { fullName: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  if (options?.role) {
    where.role = options.role;
  }

  return prisma.user.findMany({
    where,
    select: STAFF_LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get Staff By ID ──────────────────────────────────────────────────────────

export async function getStaffById(
  tenantId: string,
  id: string,
  options: { includeSensitive?: boolean } = {},
) {
  const user = await prisma.user.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: STAFF_SELECT,
  });

  if (!user) {
    throw new Error('Staff member not found');
  }

  // ARGUS #341: HR/salary/bank fields are only returned to the stronger
  // staff:manage permission. A plain staff:view caller still sees the
  // directory identity/access data, but the account number is masked.
  return toStaffDetailDto(user as unknown as Record<string, unknown>, {
    includeSensitive: options.includeSensitive === true,
  });
}

// ── Update Staff ─────────────────────────────────────────────────────────────

/**
 * M03-02 (BUG-4): takes the acting user so role/permission audits carry a
 * real actorId/actorRole and use the durable writeAuditLog (a failed security
 * audit rethrows → the route 500s, because an unaudited privilege change is
 * worse than a failed request).
 * M03-04 (BUG-6): any change to role / permissions / isActive bumps
 * sessionVersion in the SAME update, so the M01-06 proxy gate terminates the
 * subject's live JWT on their next request (revocations apply immediately,
 * not at next login). The proxy reads sessionVersion straight from the DB —
 * there is no cache to clear here.
 */
export async function updateStaff(
  tenantId: string,
  id: string,
  data: UpdateStaffInput,
  actor: AuditActor,
) {
  const existing = await assertStaffBelongsToTenant(tenantId, id);

  // Role hierarchy (ARGUS #335): staff:manage does not let a manager touch an
  // owner/manager, change their own privileges, or grant permissions they do
  // not hold.
  if (!canManageStaffRole(actor.role, existing.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot manage a staff member at this role level');
  }
  if (
    actor.role === 'MANAGER' &&
    id === actor.id &&
    (data.role !== undefined || data.permissions !== undefined || data.isActive !== undefined)
  ) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Managers cannot change their own role, status or permissions',
    );
  }
  if (data.role !== undefined && !canAssignRole(actor.role, data.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot assign this role');
  }
  if (data.permissions !== undefined) {
    assertPermissionsGrantable(actor.role, data.permissions);
  }
  const demotesOwner =
    existing.role === 'OWNER' &&
    ((data.role !== undefined && data.role !== 'OWNER') || data.isActive === false);
  if (demotesOwner) {
    const otherActiveOwners = await prisma.user.count({
      where: { tenantId, role: 'OWNER', isActive: true, deletedAt: null, id: { not: id } },
    });
    assertLastOwnerRemains({
      existingRole: existing.role,
      existingIsActive: existing.isActive,
      nextRole: data.role,
      nextIsActive: data.isActive,
      otherActiveOwners,
    });
  }

  const updateData: Record<string, unknown> = {};

  if (data.email !== undefined) {
    updateData.email = data.email;
  }
  if (data.role !== undefined) {
    if (data.role === UserRole.SUPER_ADMIN) {
      // Sentinel prose kept for the escalation-guard contract (tests 8.7/8.8).
      throw new Error('Cannot assign SUPER_ADMIN role');
    }
    updateData.role = data.role;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }
  if (data.commissionRate !== undefined) {
    updateData.commissionRate = parseFloat(data.commissionRate);
  }

  // HR profile: an explicit empty string clears the nullable column.
  const assignText = (key: keyof StaffProfileFields) => {
    const value = data[key];
    if (value === undefined) return;
    const trimmed = value.trim();
    updateData[key] = trimmed === '' ? null : trimmed;
  };
  const assignMoney = (key: 'basicSalary' | 'allowances') => {
    const value = data[key];
    if (value === undefined) return;
    const trimmed = value.trim();
    updateData[key] = trimmed === '' ? null : Number(trimmed);
  };
  assignText('fullName');
  assignText('nic');
  assignText('contactNumber');
  assignText('address');
  assignText('bankName');
  assignText('bankBranch');
  assignText('bankAccountNumber');
  assignText('etfNumber');
  assignText('epfNumber');
  assignMoney('basicSalary');
  assignMoney('allowances');

  const nextRole = data.role ?? existing.role;
  // ARGUS #464: the stored payload is extras plus `!`-prefixed revokes, so a
  // deny survives the round-trip and is compared like any other change.
  const beforePermissions = permissionPayloadToSave(existing.permissions, existing.role);
  const nextPermissions = data.permissions !== undefined
    ? permissionPayloadToSave(data.permissions, nextRole)
    : beforePermissions;
  const permissionsChanged =
    data.permissions !== undefined &&
    !samePermissionSet(beforePermissions, nextPermissions);

  // Only write the permissions column when the normalized extras changed. A
  // legacy row that stores all inherited defaults is left untouched by a
  // no-op save, so the row cannot churn 8 -> 4 without a real change.
  if (permissionsChanged) {
    updateData.permissions = nextPermissions;
  }

  // M03-04: privilege-revoking change → invalidate live sessions.
  const roleChanged = data.role !== undefined && data.role !== existing.role;
  const activeChanged = data.isActive !== undefined && data.isActive !== existing.isActive;

  if (roleChanged || activeChanged || permissionsChanged) {
    updateData.sessionVersion = { increment: 1 };
  }

  // ARGUS #463: the staff update and every security audit row are one
  // transaction. A failed audit rolls the change back instead of committing an
  // unaudited role/permission/status change and then returning 500.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: updateData,
      select: STAFF_SELECT,
    });

    if (roleChanged) {
      await writeAuditLogTx(tx, {
        tenantId,
        actorId: actor.id,
        actorRole: actor.role,
        entityType: 'Staff',
        entityId: id,
        action: AUDIT_ACTIONS.STAFF_ROLE_CHANGED,
        before: { role: existing.role },
        after: { role: data.role },
      });
    }

    if (permissionsChanged) {
      const afterPermissions = permissionPayloadToSave(updated.permissions, nextRole);

      await writeAuditLogTx(tx, {
        tenantId,
        actorId: actor.id,
        actorRole: actor.role,
        entityType: 'Staff',
        entityId: id,
        action: AUDIT_ACTIONS.STAFF_PERMISSION_CHANGED,
        before: { permissions: beforePermissions },
        after: { permissions: afterPermissions },
      });
    }

    // ARGUS #463: active-status changes get their own security row instead of
    // disappearing into the generic details audit (or none at all).
    if (activeChanged) {
      await writeAuditLogTx(tx, {
        tenantId,
        actorId: actor.id,
        actorRole: actor.role,
        entityType: 'Staff',
        entityId: id,
        action: AUDIT_ACTIONS.STAFF_STATUS_CHANGED,
        before: { isActive: existing.isActive },
        after: { isActive: data.isActive },
      });
    }

    // HR / contact / salary / bank changes are security-sensitive too (ARGUS
    // #336). Without this row an admin edit of a bank account or salary left no
    // audit trail. isActive has its own action above.
    const detailFields = [
      'email',
      'fullName',
      'nic',
      'contactNumber',
      'address',
      'basicSalary',
      'allowances',
      'bankName',
      'bankBranch',
      'bankAccountNumber',
      'etfNumber',
      'epfNumber',
    ] as const;
    const changedDetailFields = detailFields.filter(
      (key) => (data as Record<string, unknown>)[key] !== undefined,
    );
    if (changedDetailFields.length > 0) {
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const key of changedDetailFields) {
        before[key] = (existing as Record<string, unknown>)[key] ?? null;
        after[key] = updateData[key] ?? (data as Record<string, unknown>)[key] ?? null;
      }
      await writeAuditLogTx(tx, {
        tenantId,
        actorId: actor.id,
        actorRole: actor.role,
        entityType: 'Staff',
        entityId: id,
        action: AUDIT_ACTIONS.STAFF_DETAILS_UPDATED,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      });
    }

    // Commission rate changes alter future pay; keep the dedicated action even
    // when the same PATCH edits profile fields (ARGUS #340/#463).
    const beforeCommissionRate = formatCommissionRateForAudit(existing.commissionRate);
    const afterCommissionRate = formatCommissionRateForAudit(updated.commissionRate);
    if (beforeCommissionRate !== afterCommissionRate) {
      await writeAuditLogTx(tx, {
        tenantId,
        actorId: actor.id,
        actorRole: actor.role,
        entityType: 'Staff',
        entityId: id,
        action: AUDIT_ACTIONS.STAFF_COMMISSION_RATE_CHANGED,
        before: { commissionRate: beforeCommissionRate },
        after: { commissionRate: afterCommissionRate },
      });
    }

    return updated;
  });
}

// ── Create Staff Member ──────────────────────────────────────────────────────

/**
 * M03-06 (BUG-8): check-then-insert is replaced by insert-and-map — the
 * unique constraint on email is the guarantee; a racing loser gets a P2002
 * mapped to a typed 409 (never a 500). The pre-check survives only as a
 * friendly-message fast path.
 * M03-08 (GAP-2): the random temp password is never returned or emailed — a
 * created account cannot sign in until an OWNER sets one via
 * /api/store/staff/[id]/password. Returns the created record.
 */
export async function createStaffMember(
  tenantId: string,
  data: CreateStaffInput,
  actor: AuditActor,
) {
  if (data.role === UserRole.SUPER_ADMIN) {
    throw new Error('Cannot assign SUPER_ADMIN role');
  }
  if (!canAssignRole(actor.role, data.role)) {
    throw new Error('STAFF_ROLE_NOT_ASSIGNABLE');
  }

  const tempPassword = randomUUID();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const fullName = cleanOptional(data.fullName);
  const nic = cleanOptional(data.nic);
  const contactNumber = cleanOptional(data.contactNumber);
  const address = cleanOptional(data.address);
  const basicSalary = parseOptionalDecimal(data.basicSalary);
  const allowances = parseOptionalDecimal(data.allowances);
  const bankName = cleanOptional(data.bankName);
  const bankBranch = cleanOptional(data.bankBranch);
  const bankAccountNumber = cleanOptional(data.bankAccountNumber);
  const etfNumber = cleanOptional(data.etfNumber);
  const epfNumber = cleanOptional(data.epfNumber);

  const created = await withUniqueGuard(
    () =>
      prisma.user.create({
        data: {
          tenantId,
          email: data.email,
          passwordHash,
          role: data.role,
          ...(data.commissionRate !== undefined && {
            commissionRate: parseFloat(data.commissionRate),
          }),
          ...(fullName !== undefined && { fullName }),
          ...(nic !== undefined && { nic }),
          ...(contactNumber !== undefined && { contactNumber }),
          ...(address !== undefined && { address }),
          ...(basicSalary !== undefined && { basicSalary }),
          ...(allowances !== undefined && { allowances }),
          ...(bankName !== undefined && { bankName }),
          ...(bankBranch !== undefined && { bankBranch }),
          ...(bankAccountNumber !== undefined && { bankAccountNumber }),
          ...(etfNumber !== undefined && { etfNumber }),
          ...(epfNumber !== undefined && { epfNumber }),
        },
        select: STAFF_SELECT,
      }),
    'A user with this email already exists',
  ).catch((error) => {
    // Non-race errors keep the Prisma mapping (typed 4xx, no raw dump).
    throw mapPrismaError(error) ?? error;
  });

  // ARGUS #340: account creation is security-relevant. The snapshot is
  // allow-listed (no passwordHash) and bounded. Durable write: an unaudited
  // staff account must not report success.
  await writeAuditLog({
    tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'Staff',
    entityId: created.id,
    action: AUDIT_ACTIONS.STAFF_CREATED,
    after: buildStaffAuditSnapshot(
      created as unknown as Record<string, unknown>,
      STAFF_CREATED_AUDIT_FIELDS,
    ) as Prisma.InputJsonValue,
  });

  return created;
}

/**
 * M03-08 (GAP-2) — admin set-password for a staff member.
 *
 * OWNER-only (enforced at the route). Mirrors the reset-password /
 * settings/account precedent (NEW-D): hash + bump sessionVersion in ONE
 * update so any live session of the subject dies immediately. The audit row
 * is security-relevant → durable writeAuditLog with the real actor.
 */
export async function setStaffPassword(
  tenantId: string,
  id: string,
  newPassword: string,
  actor: AuditActor,
  context?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const existing = await assertStaffBelongsToTenant(tenantId, id);

  if (!canResetStaffPassword(actor.role, existing.role)) {
    throw new Error('STAFF_PASSWORD_RESET_FORBIDDEN');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
      isActive: true,
    },
    select: STAFF_SELECT,
  });

  await writeAuditLog({
    tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'Staff',
    entityId: existing.id,
    action: AUDIT_ACTIONS.STAFF_PASSWORD_RESET,
    after: { sessionVersionBumped: true },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}
