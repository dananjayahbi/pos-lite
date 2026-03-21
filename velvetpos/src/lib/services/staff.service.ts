import { prisma } from '@/lib/prisma';
import { UserRole } from '@/generated/prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

// ── Types ────────────────────────────────────────────────────────────────────

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
  clearPin?: boolean | undefined;
}

const STAFF_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
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
    throw new Error('Staff member not found');
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
    select: {
      ...STAFF_SELECT,
      pin: true,
    },
  });

  if (!user) {
    throw new Error('Staff member not found');
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    commissionRate: user.commissionRate,
    clockedInAt: user.clockedInAt,
    createdAt: user.createdAt,
    hasPinSet: user.pin !== null,
  };
}

// ── Update Staff ─────────────────────────────────────────────────────────────

export async function updateStaff(tenantId: string, id: string, data: UpdateStaffInput) {
  const existing = await assertStaffBelongsToTenant(tenantId, id);

  const updateData: Record<string, unknown> = {};

  if (data.email !== undefined) {
    updateData.email = data.email;
  }
  if (data.role !== undefined) {
    if (data.role === UserRole.SUPER_ADMIN) {
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
  if (data.clearPin === true) {
    updateData.pin = null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: STAFF_SELECT,
  });

  if (data.role !== undefined && data.role !== existing.role) {
    void createAuditLog({
      tenantId,
      actorId: null,
      actorRole: 'SYSTEM',
      entityType: 'Staff',
      entityId: id,
      action: AUDIT_ACTIONS.STAFF_ROLE_CHANGED,
      before: { role: existing.role },
      after: { role: data.role },
    }).catch(() => {});
  }

  if (data.clearPin === true) {
    void createAuditLog({
      tenantId,
      actorId: null,
      actorRole: 'SYSTEM',
      entityType: 'Staff',
      entityId: id,
      action: AUDIT_ACTIONS.STAFF_PIN_CHANGED,
      after: { pinCleared: true },
    }).catch(() => {});
  }

  return updated;
}

// ── Create Staff Member ──────────────────────────────────────────────────────

export async function createStaffMember(tenantId: string, data: CreateStaffInput) {
  if (data.role === UserRole.SUPER_ADMIN) {
    throw new Error('Cannot assign SUPER_ADMIN role');
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error('A user with this email already exists');
  }

  const tempPassword = randomUUID();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  return prisma.user.create({
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
  });
}
