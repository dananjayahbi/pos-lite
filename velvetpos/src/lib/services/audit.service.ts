/**
 * Audit Logging Service
 *
 * VelvetPOS uses a dual audit architecture:
 *
 * 1. StockMovement table — source of truth for all inventory quantity changes.
 *    Every adjustment, stock take correction, purchase, and sale creates a
 *    StockMovement record with quantityBefore/After snapshots. Do NOT create
 *    AuditLog entries for stock quantity changes.
 *
 * 2. AuditLog table — records administrative and business-level events that are
 *    not inventory movements: product lifecycle (create/update/delete), price
 *    changes, stock take decisions (approve/reject), and auth events.
 *
 * Action string conventions (SCREAMING_SNAKE_CASE):
 *   - PRODUCT_CREATED, PRODUCT_UPDATED, PRODUCT_DELETED
 *   - VARIANT_PRICE_CHANGED
 *   - STOCK_TAKE_APPROVED, STOCK_TAKE_REJECTED
 *   - AUTH_ACTIONS (LOGIN_SUCCESS, LOGIN_FAILED_*, LOGOUT, etc.)
 *
 * Audit log failures are swallowed and logged server-side without re-throwing.
 * The primary business operation must always succeed regardless of audit write
 * outcome.
 */
import { createHash } from 'crypto';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export const AUTH_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED_INVALID_CREDENTIALS: 'LOGIN_FAILED_INVALID_CREDENTIALS',
  LOGIN_FAILED_ACCOUNT_INACTIVE: 'LOGIN_FAILED_ACCOUNT_INACTIVE',
  LOGIN_FAILED_ACCOUNT_SUSPENDED: 'LOGIN_FAILED_ACCOUNT_SUSPENDED',
  PIN_LOGIN_SUCCESS: 'PIN_LOGIN_SUCCESS',
  PIN_LOGIN_FAILED: 'PIN_LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  SESSION_INVALIDATED_BY_VERSION_MISMATCH: 'SESSION_INVALIDATED_BY_VERSION_MISMATCH',
  FORCE_LOGOUT_TRIGGERED: 'FORCE_LOGOUT_TRIGGERED',
} as const;

export const AUDIT_ACTIONS = {
  // Sale
  SALE_COMPLETED: 'SALE_COMPLETED',
  SALE_VOIDED: 'SALE_VOIDED',
  // Return
  RETURN_COMPLETED: 'RETURN_COMPLETED',
  // Customer
  CUSTOMER_CREDIT_ADJUSTED: 'CUSTOMER_CREDIT_ADJUSTED',
  // Purchase Order
  PO_STATUS_CHANGED: 'PO_STATUS_CHANGED',
  // Staff
  STAFF_ROLE_CHANGED: 'STAFF_ROLE_CHANGED',
  STAFF_PIN_CHANGED: 'STAFF_PIN_CHANGED',
  STAFF_PERMISSION_CHANGED: 'STAFF_PERMISSION_CHANGED',
  // Promotion
  PROMOTION_CREATED: 'PROMOTION_CREATED',
  PROMOTION_UPDATED: 'PROMOTION_UPDATED',
  PROMOTION_ARCHIVED: 'PROMOTION_ARCHIVED',
  // Stock
  STOCK_ADJUSTED: 'STOCK_ADJUSTED',
  // Expense
  EXPENSE_CREATED: 'EXPENSE_CREATED',
  EXPENSE_DELETED: 'EXPENSE_DELETED',
  // Shift
  SHIFT_CLOSED: 'SHIFT_CLOSED',
  // Settings
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
} as const;

export type AuthAction = (typeof AUTH_ACTIONS)[keyof typeof AUTH_ACTIONS];
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface CreateAuditLogInput {
  tenantId: string | null;
  actorId: string | null;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: AuthAction | string;
  before?: Prisma.InputJsonValue | null | undefined;
  after?: Prisma.InputJsonValue | null | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    const beforeData =
      input.before === undefined ? undefined : input.before === null ? Prisma.JsonNull : input.before;
    const afterData =
      input.after === undefined ? undefined : input.after === null ? Prisma.JsonNull : input.after;

    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        ...(beforeData !== undefined ? { before: beforeData } : {}),
        ...(afterData !== undefined ? { after: afterData } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
      },
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

export function hashEmailForAudit(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

// ── Get Audit Logs (Paginated) ───────────────────────────────────────────────

interface GetAuditLogsFilters {
  entityType?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  userId?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export async function getAuditLogs(tenantId: string, filters: GetAuditLogsFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? 50), 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = { tenantId };

  if (filters.entityType !== undefined) {
    where.entityType = filters.entityType;
  }
  if (filters.userId !== undefined) {
    where.actorId = filters.userId;
  }
  if (filters.startDate !== undefined || filters.endDate !== undefined) {
    where.createdAt = {
      ...(filters.startDate !== undefined ? { gte: filters.startDate } : {}),
      ...(filters.endDate !== undefined ? { lte: filters.endDate } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total, page, pageSize };
}
