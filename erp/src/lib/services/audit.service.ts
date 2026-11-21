/**
 * Audit Logging Service
 *
 * AyurPOS uses a dual audit architecture:
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
import { staffDisplayName } from '@/lib/utils/staff-name';

export const AUTH_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED_INVALID_CREDENTIALS: 'LOGIN_FAILED_INVALID_CREDENTIALS',
  LOGIN_FAILED_ACCOUNT_INACTIVE: 'LOGIN_FAILED_ACCOUNT_INACTIVE',
  LOGIN_FAILED_ACCOUNT_SUSPENDED: 'LOGIN_FAILED_ACCOUNT_SUSPENDED',
  // M08-01 (BUG-35): valid credentials rejected because the tenant is suspended/cancelled.
  LOGIN_FAILED_TENANT_SUSPENDED: 'LOGIN_FAILED_TENANT_SUSPENDED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  // M01-01: reset email minted but delivery failed (token purged, ops signal).
  PASSWORD_RESET_DELIVERY_FAILED: 'PASSWORD_RESET_DELIVERY_FAILED',
  // M01-02: forgot-password suppressed by the per-IP limiter (429 path).
  PASSWORD_RESET_THROTTLED: 'PASSWORD_RESET_THROTTLED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_CHANGE_FAILED: 'PASSWORD_CHANGE_FAILED',
  PASSWORD_CHANGE_THROTTLED: 'PASSWORD_CHANGE_THROTTLED',
  SESSION_INVALIDATED_BY_VERSION_MISMATCH: 'SESSION_INVALIDATED_BY_VERSION_MISMATCH',
  FORCE_LOGOUT_TRIGGERED: 'FORCE_LOGOUT_TRIGGERED',
} as const;

export const AUDIT_ACTIONS = {
  // Sale
  SALE_COMPLETED: 'SALE_COMPLETED',
  SALE_ZERO_VALUE_COMPLETED: 'SALE_ZERO_VALUE_COMPLETED',
  SALE_VOIDED: 'SALE_VOIDED',
  // TASK B: amendments to a completed sale's mutable details (customer,
  // accounting date, delivery charge). Line items/payments are immutable.
  SALE_DETAILS_UPDATED: 'SALE_DETAILS_UPDATED',
  // Return
  RETURN_COMPLETED: 'RETURN_COMPLETED',
  RETURN_CANCELLED: 'RETURN_CANCELLED',
  // Customer
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED',
  CUSTOMER_IMPORTED: 'CUSTOMER_IMPORTED',
  CUSTOMER_CREDIT_ADJUSTED: 'CUSTOMER_CREDIT_ADJUSTED',
  // Purchase Order
  PURCHASE_ORDER_CREATED: 'PURCHASE_ORDER_CREATED',
  PURCHASE_ORDER_UPDATED: 'PURCHASE_ORDER_UPDATED',
  PURCHASE_ORDER_CANCELLED: 'PURCHASE_ORDER_CANCELLED',
  PURCHASE_ORDER_PAID: 'PURCHASE_ORDER_PAID',
  PO_STATUS_CHANGED: 'PO_STATUS_CHANGED',
  // Staff
  STAFF_ROLE_CHANGED: 'STAFF_ROLE_CHANGED',
  STAFF_PERMISSION_CHANGED: 'STAFF_PERMISSION_CHANGED',
  // ARGUS #340: creation, HR/contact/salary/bank edits, deactivation and
  // commission-rate changes now carry an explicit action. The legacy generic
  // action is retained so historical rows stay filterable.
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  STAFF_DEACTIVATED: 'STAFF_DEACTIVATED',
  STAFF_REACTIVATED: 'STAFF_REACTIVATED',
  STAFF_COMMISSION_RATE_CHANGED: 'STAFF_COMMISSION_RATE_CHANGED',
  STAFF_DETAILS_UPDATED: 'STAFF_DETAILS_UPDATED',
  // ARGUS #463: activating/deactivating an account is a security change with
  // its own action (previously folded into the generic details row).
  STAFF_STATUS_CHANGED: 'STAFF_STATUS_CHANGED',
  // Attendance / time clock
  ATTENDANCE_ADJUSTED: 'ATTENDANCE_ADJUSTED',
  ATTENDANCE_STATUS_SET: 'ATTENDANCE_STATUS_SET',
  // ARGUS #357: every self-service clock-in/out, regardless of role.
  ATTENDANCE_CLOCKED_IN: 'ATTENDANCE_CLOCKED_IN',
  ATTENDANCE_CLOCKED_OUT: 'ATTENDANCE_CLOCKED_OUT',
  // ARGUS #349: a manually added clock punch.
  ATTENDANCE_PUNCH_ADDED: 'ATTENDANCE_PUNCH_ADDED',
  // ARGUS #351: an open punch closed at the maximum-shift cap.
  ATTENDANCE_PUNCH_AUTO_CAPPED: 'ATTENDANCE_PUNCH_AUTO_CAPPED',
  // ARGUS #348: working-week/holiday calendar in Tenant.settings.attendance.
  ATTENDANCE_CALENDAR_UPDATED: 'ATTENDANCE_CALENDAR_UPDATED',
  // M03-08 (GAP-2): admin set-password on a staff account.
  STAFF_PASSWORD_RESET: 'STAFF_PASSWORD_RESET',
  // Promotion
  PROMOTION_CREATED: 'PROMOTION_CREATED',
  PROMOTION_UPDATED: 'PROMOTION_UPDATED',
  PROMOTION_ARCHIVED: 'PROMOTION_ARCHIVED',
  // ARGUS #325: explicit reactivation (distinct from PROMOTION_ARCHIVED).
  PROMOTION_ACTIVATED: 'PROMOTION_ACTIVATED',
  // ARGUS #331: customer-specific pricing rules are master data too.
  CUSTOMER_PRICING_RULE_CREATED: 'CUSTOMER_PRICING_RULE_CREATED',
  CUSTOMER_PRICING_RULE_UPDATED: 'CUSTOMER_PRICING_RULE_UPDATED',
  CUSTOMER_PRICING_RULE_DEACTIVATED: 'CUSTOMER_PRICING_RULE_DEACTIVATED',
  // Stock
  STOCK_ADJUSTED: 'STOCK_ADJUSTED',
  // Expense
  EXPENSE_CREATED: 'EXPENSE_CREATED',
  EXPENSE_UPDATED: 'EXPENSE_UPDATED',
  EXPENSE_DELETED: 'EXPENSE_DELETED',
  // Petty Cash
  PETTY_CASH_FUND_CREATED: 'PETTY_CASH_FUND_CREATED',
  PETTY_CASH_FUND_UPDATED: 'PETTY_CASH_FUND_UPDATED',
  PETTY_CASH_TOP_UP: 'PETTY_CASH_TOP_UP',
  // Payment Accounts (ledger-backed money containers)
  PAYMENT_ACCOUNT_CREATED: 'PAYMENT_ACCOUNT_CREATED',
  PAYMENT_ACCOUNT_UPDATED: 'PAYMENT_ACCOUNT_UPDATED',
  PAYMENT_ACCOUNT_CLOSED: 'PAYMENT_ACCOUNT_CLOSED',
  PAYMENT_ACCOUNT_TRANSFER: 'PAYMENT_ACCOUNT_TRANSFER',
  PAYMENT_ACCOUNT_DEPOSIT: 'PAYMENT_ACCOUNT_DEPOSIT',
  PAYMENT_ACCOUNT_WITHDRAWAL: 'PAYMENT_ACCOUNT_WITHDRAWAL',
  // Shift
  SHIFT_CLOSED: 'SHIFT_CLOSED',
  // Commissions
  COMMISSION_PAYOUT_CREATED: 'COMMISSION_PAYOUT_CREATED',
  // Payroll
  PAYROLL_RUN_GENERATED: 'PAYROLL_RUN_GENERATED',
  PAYROLL_RUN_PAID: 'PAYROLL_RUN_PAID',
  PAYROLL_RUN_VOIDED: 'PAYROLL_RUN_VOIDED',
  PAYROLL_PAYSLIP_EMAILED: 'PAYROLL_PAYSLIP_EMAILED',
  PAYROLL_SETTINGS_UPDATED: 'PAYROLL_SETTINGS_UPDATED',
  // Settings
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  // Delivery / Courier
  DELIVERY_CREATED: 'DELIVERY_CREATED',
  DELIVERY_UPDATED: 'DELIVERY_UPDATED',
  DELIVERY_CANCELED: 'DELIVERY_CANCELED',
  DELIVERY_DISPATCHED: 'DELIVERY_DISPATCHED',
  DELIVERY_DISPATCH_ORPHANED: 'DELIVERY_DISPATCH_ORPHANED',
  DELIVERY_STATUS_CHANGED: 'DELIVERY_STATUS_CHANGED',
  DELIVERY_RECOVERY_LOGGED: 'DELIVERY_RECOVERY_LOGGED',
  DELIVERY_REDELIVERED: 'DELIVERY_REDELIVERED',
  DELIVERY_RECOVERY_CANCELLED: 'DELIVERY_RECOVERY_CANCELLED',
  RATE_CARD_UPDATED: 'RATE_CARD_UPDATED',
  COURIER_SETTINGS_UPDATED: 'COURIER_SETTINGS_UPDATED',
  LABEL_TEMPLATE_UPDATED: 'LABEL_TEMPLATE_UPDATED',
  PACKAGING_STOCK_ADJUSTED: 'PACKAGING_STOCK_ADJUSTED',
  PACKAGING_ITEM_CREATED: 'PACKAGING_ITEM_CREATED',
  PACKAGING_ITEM_UPDATED: 'PACKAGING_ITEM_UPDATED',
  PACKAGING_ITEM_DELETED: 'PACKAGING_ITEM_DELETED',
  PACKAGING_CATEGORY_CREATED: 'PACKAGING_CATEGORY_CREATED',
  PACKAGING_CATEGORY_UPDATED: 'PACKAGING_CATEGORY_UPDATED',
  PACKAGING_CATEGORY_DELETED: 'PACKAGING_CATEGORY_DELETED',
  RECONCILIATION_IMPORTED: 'RECONCILIATION_IMPORTED',
  /** ARGUS #511: historical delivered-COD ledger rows created by the backfill. */
  RECONCILIATION_COD_BACKFILLED: 'RECONCILIATION_COD_BACKFILLED',
  // M26-02/OBS-40: dispute operations were all logged as RECONCILIATION_IMPORTED,
  // so the ledger could not tell open/update/resolve apart.
  RECONCILIATION_DISPUTE_OPENED: 'RECONCILIATION_DISPUTE_OPENED',
  RECONCILIATION_DISPUTE_UPDATED: 'RECONCILIATION_DISPUTE_UPDATED',
  RECONCILIATION_DISPUTE_RESOLVED: 'RECONCILIATION_DISPUTE_RESOLVED',
  // Raw Material (Factory)
  RAW_MATERIAL_CREATED: 'RAW_MATERIAL_CREATED',
  RAW_MATERIAL_UPDATED: 'RAW_MATERIAL_UPDATED',
  RAW_MATERIAL_DELETED: 'RAW_MATERIAL_DELETED',
  RAW_MATERIAL_STOCK_ADJUSTED: 'RAW_MATERIAL_STOCK_ADJUSTED',
  RAW_MATERIAL_CATEGORY_CREATED: 'RAW_MATERIAL_CATEGORY_CREATED',
  RAW_MATERIAL_CATEGORY_UPDATED: 'RAW_MATERIAL_CATEGORY_UPDATED',
  RAW_MATERIAL_CATEGORY_DELETED: 'RAW_MATERIAL_CATEGORY_DELETED',
  RAW_MATERIAL_UNIT_CREATED: 'RAW_MATERIAL_UNIT_CREATED',
  RAW_MATERIAL_UNIT_UPDATED: 'RAW_MATERIAL_UNIT_UPDATED',
  RAW_MATERIAL_UNIT_DELETED: 'RAW_MATERIAL_UNIT_DELETED',
  // Bill of Materials & Production (Factory)
  BOM_CREATED: 'BOM_CREATED',
  BOM_RESTORED: 'BOM_RESTORED',
  BOM_UPDATED: 'BOM_UPDATED',
  BOM_DELETED: 'BOM_DELETED',
  PRODUCTION_LOGGED: 'PRODUCTION_LOGGED',
  // Product lifecycle (M02-03 — soft-delete recovery)
  PRODUCT_RESTORED: 'PRODUCT_RESTORED',
  // Supplier lifecycle (M06-05 — archive recovery). Append-only.
  SUPPLIER_UNARCHIVED: 'SUPPLIER_UNARCHIVED',
  // ARGUS #237: create/edit/archive were never audited, leaving the Supplier
  // trail with restore events only.
  SUPPLIER_CREATED: 'SUPPLIER_CREATED',
  SUPPLIER_UPDATED: 'SUPPLIER_UPDATED',
  SUPPLIER_ARCHIVED: 'SUPPLIER_ARCHIVED',
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

/**
 * Build the Prisma payload once so the best-effort and transactional writers
 * cannot drift. `null` before/after values are explicit JSON nulls, while an
 * omitted field stays absent.
 */
export function buildAuditLogData(
  input: CreateAuditLogInput,
): Prisma.AuditLogUncheckedCreateInput {
  const beforeData =
    input.before === undefined ? undefined : input.before === null ? Prisma.JsonNull : input.before;
  const afterData =
    input.after === undefined ? undefined : input.after === null ? Prisma.JsonNull : input.after;

  return {
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
  };
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({ data: buildAuditLogData(input) });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

/**
 * Financial audit rows that must commit or roll back with the money movement
 * they describe (ARGUS #426).
 *
 * `createAuditLog` deliberately swallows failures and uses the global client,
 * which is correct for view-ish events but wrong inside a money transaction:
 * a rollback could leave an orphan audit row, or a commit could have no row.
 * Callers pass their `tx` and this writer rethrows, so the audit is atomic with
 * the ledger posting / account mutation.
 */
export const FINANCIAL_AUDIT_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.PAYMENT_ACCOUNT_CREATED,
  AUDIT_ACTIONS.PAYMENT_ACCOUNT_UPDATED,
  AUDIT_ACTIONS.PAYMENT_ACCOUNT_CLOSED,
  AUDIT_ACTIONS.PAYMENT_ACCOUNT_TRANSFER,
  AUDIT_ACTIONS.PAYMENT_ACCOUNT_DEPOSIT,
  AUDIT_ACTIONS.PAYMENT_ACCOUNT_WITHDRAWAL,
]);

export async function createAuditLogInTransaction(
  tx: Pick<Prisma.TransactionClient, 'auditLog'>,
  input: CreateAuditLogInput,
): Promise<void> {
  await tx.auditLog.create({ data: buildAuditLogData(input) });
}

/**
 * M03-02 (NEW-A) — durability variant of createAuditLog for SECURITY-RELEVANT
 * trails (staff role/permission changes, force-logout, admin set-password).
 *
 * Unlike createAuditLog it does NOT swallow failures: an unaudited privilege
 * change is worse than a failed request, so it rethrows and the calling route
 * surfaces a 500. Best-effort/view-ish events keep using createAuditLog (or
 * fire-and-forget with a console error), never a silent `.catch(() => {})`.
 */
/** Minimal client shape shared by PrismaClient and a transaction client. */
type AuditLogClient = Pick<typeof prisma, 'auditLog'>;

async function writeAuditLogOn(
  client: AuditLogClient,
  input: CreateAuditLogInput,
): Promise<void> {
  const beforeData =
    input.before === undefined ? undefined : input.before === null ? Prisma.JsonNull : input.before;
  const afterData =
    input.after === undefined ? undefined : input.after === null ? Prisma.JsonNull : input.after;

  try {
    await client.auditLog.create({
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
    console.error('SECURITY audit log write failed:', input.action, error);
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(error, {
        tags: { audit: 'write-failed', action: input.action },
      });
    } catch {
      /* Sentry unavailable — the console.error above is the fallback signal */
    }
    throw error;
  }
}

/**
 * ARGUS #463 — transaction-aware durable audit writer.
 *
 * Use this inside the same `$transaction` as the security-sensitive write so a
 * failed audit rolls the write back. The change can never be committed without
 * its audit row.
 */
export async function writeAuditLogTx(
  tx: Prisma.TransactionClient,
  input: CreateAuditLogInput,
): Promise<void> {
  await writeAuditLogOn(tx, input);
}

export async function writeAuditLog(input: CreateAuditLogInput): Promise<void> {
  await writeAuditLogOn(prisma, input);
}

export function hashEmailForAudit(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

// ── Get Audit Logs (Paginated) ───────────────────────────────────────────────

interface GetAuditLogsFilters {
  entityType?: string | undefined;
  action?: string | undefined;
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
  if (filters.action !== undefined) {
    where.action = filters.action;
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

/**
 * Every row matching the filters, for a complete CSV export (ARGUS #453).
 *
 * The UI export used to reuse the paginated list (max 100 rows) and omit the
 * before/after/userAgent evidence. This returns the full filtered set with all
 * columns the detail modal shows.
 */
export async function getAuditLogsForExport(
  tenantId: string | undefined,
  filters: Omit<GetAuditLogsFilters, 'page' | 'pageSize'> = {},
) {
  const where: Prisma.AuditLogWhereInput = {};
  if (tenantId !== undefined) where.tenantId = tenantId;
  if (filters.entityType !== undefined) where.entityType = filters.entityType;
  if (filters.action !== undefined) where.action = filters.action;
  if (filters.userId !== undefined) where.actorId = filters.userId;
  if (filters.startDate !== undefined || filters.endDate !== undefined) {
    where.createdAt = {
      ...(filters.startDate !== undefined ? { gte: filters.startDate } : {}),
      ...(filters.endDate !== undefined ? { lte: filters.endDate } : {}),
    };
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Resolve `actorId` values to human-readable user labels for the audit log UI
 * and export. System-generated rows (no actor) render as "System"; deleted or
 * unknown users fall back to a neutral label instead of leaking a bare CUID.
 */
export async function attachAuditActorNames<T extends { actorId: string | null }>(
  entries: T[],
  tenantId?: string | null,
): Promise<Array<T & { actorName: string }>> {
  const actorIds = Array.from(
    new Set(entries.map((entry) => entry.actorId).filter((id): id is string => Boolean(id))),
  );

  const users =
    actorIds.length > 0
      ? await prisma.user.findMany({
          // Actor resolution must not leak another tenant's name when an audit
          // row carries a foreign id (ARGUS #456). SUPER_ADMIN/cross-tenant
          // views call without a tenant scope.
          where: { id: { in: actorIds }, ...(tenantId ? { tenantId } : {}) },
          select: { id: true, email: true },
        })
      : [];
  const emailById = new Map(users.map((user) => [user.id, user.email]));

  return entries.map((entry) => ({
    ...entry,
    actorName: entry.actorId ? staffDisplayName(emailById.get(entry.actorId)) : 'System',
  }));
}
