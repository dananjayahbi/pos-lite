import { prisma } from '@/lib/prisma';
import { UserRole } from '@/generated/prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { mapPrismaError } from '@/lib/api/map-prisma-error';
import { withUniqueGuard } from '@/lib/api/race-guard';
import { ApiError } from '@/lib/api/errors';

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
}

interface CreateStaffInput {
  email: string;
  role: UserRole;
  commissionRate?: string | undefined;
}

interface UpdateStaffInput {
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
  createdAt: true,
} as const;

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
    where.email = { contains: options.search, mode: 'insensitive' };
  }

  return prisma.user.findMany({
    where,
    select: STAFF_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get Staff By ID ──────────────────────────────────────────────────────────

export async function getStaffById(tenantId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: STAFF_SELECT,
  });

  if (!user) {
    throw new Error('Staff member not found');
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    permissions: Array.isArray(user.permissions)
      ? user.permissions.filter((permission): permission is string => typeof permission === 'string')
      : [],
    commissionRate: user.commissionRate,
    clockedInAt: user.clockedInAt,
    createdAt: user.createdAt,
  };
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
  if (data.permissions !== undefined) {
    updateData.permissions = Array.from(
      new Set(data.permissions.filter((permission): permission is string => typeof permission === 'string')),
    ).sort();
  }

  // M03-04: privilege-revoking change → invalidate live sessions.
  const roleChanged = data.role !== undefined && data.role !== existing.role;
  const activeChanged = data.isActive !== undefined && data.isActive !== existing.isActive;
  const beforePermissions = Array.isArray(existing.permissions)
    ? existing.permissions.filter((permission): permission is string => typeof permission === 'string')
    : [];
  const permissionsChanged =
    data.permissions !== undefined &&
    JSON.stringify(
      Array.from(
        new Set(data.permissions.filter((permission): permission is string => typeof permission === 'string')),
      ).sort(),
    ) !== JSON.stringify([...beforePermissions].sort());

  if (roleChanged || activeChanged || permissionsChanged) {
    updateData.sessionVersion = { increment: 1 };
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: STAFF_SELECT,
  });

  if (roleChanged) {
    await writeAuditLog({
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
    const afterPermissions = Array.isArray(updated.permissions)
      ? updated.permissions.filter((permission): permission is string => typeof permission === 'string')
      : [];

    await writeAuditLog({
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

  return updated;
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
export async function createStaffMember(tenantId: string, data: CreateStaffInput) {
  if (data.role === UserRole.SUPER_ADMIN) {
    throw new Error('Cannot assign SUPER_ADMIN role');
  }

  const tempPassword = randomUUID();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  return withUniqueGuard(
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
        },
        select: STAFF_SELECT,
      }),
    'A user with this email already exists',
  ).catch((error) => {
    // Non-race errors keep the Prisma mapping (typed 4xx, no raw dump).
    throw mapPrismaError(error) ?? error;
  });
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
