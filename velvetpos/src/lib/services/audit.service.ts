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

export type AuthAction = (typeof AUTH_ACTIONS)[keyof typeof AUTH_ACTIONS];

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
