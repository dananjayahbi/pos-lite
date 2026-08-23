import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import type { ExpenseCategory, NotificationType } from '@/generated/prisma/client';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UpdateFundInput {
  name?: string | undefined;
  openingBalance?: number | undefined;
  lowBalanceThreshold?: number | null | undefined;
  isActive?: boolean | undefined;
  activeCategories?: ExpenseCategory[] | undefined;
}

/** Components of the petty-cash balance equation (doc 39). */
export interface BalanceEquation {
  openingBalance: number;
  totalExpenses: number;
  currentBalance: number;
}

/** Filters accepted by the petty-cash audit-trail export (doc 41). */
export interface PettyCashExportFilters {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  category?: string | undefined;
}

/** Category subtotal row for the export dataset. */
export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  count: number;
  total: number;
}

/** Structured dataset ready for serialization into the export file. */
export interface PettyCashExportData {
  fund: {
    id: string;
    name: string;
    currency: string;
    openingBalance: number;
    currentBalance: number;
    lowBalanceThreshold: number | null;
  };
  balance: BalanceEquation;
  expenses: {
    id: string;
    expenseDate: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    receiptImageUrl: string | null;
    recordedByEmail: string;
  }[];
  byCategory: ExpenseCategoryTotal[];
}

/** Outcome of evaluating a fund's balance against its low-balance threshold. */
export type LowBalanceAction = 'fire' | 'clear' | 'none';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  'MISCELLANEOUS',
  'STAFF_MEALS',
  'TEA_SUGAR',
  'OFFICE_STATIONERY',
  'TRAVEL',
];

/** Default low-balance threshold (LKR) applied to newly created funds (doc 40). */
export const DEFAULT_LOW_BALANCE_THRESHOLD = 5000;

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * Return the standalone petty-cash fund for a tenant, lazily creating a default
 * fund if none exists (doc 36). One fund per store keeps the float accountable.
 */
export async function getOrCreateFund(tenantId: string, actorId?: string) {
  const existing = await prisma.pettyCashFund.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: { expenses: { orderBy: { expenseDate: 'desc' }, take: 20 } },
  });

  if (existing) {
    return existing;
  }

  const fund = await prisma.pettyCashFund.create({
    data: {
      tenantId,
      name: 'Main Petty Cash',
      openingBalance: 0,
      currentBalance: 0,
      lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
      activeCategories: DEFAULT_CATEGORIES,
    },
    include: { expenses: true },
  });

  if (actorId) {
    void createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'PettyCashFund',
      entityId: fund.id,
      action: AUDIT_ACTIONS.PETTY_CASH_FUND_CREATED,
      after: { openingBalance: 0, currentBalance: 0 },
    }).catch(() => {});
  }

  return fund;
}

/** Fetch a fund by id (tenant-scoped) with its linked expenses. */
export async function getFund(tenantId: string, fundId: string) {
  return prisma.pettyCashFund.findFirst({
    where: { id: fundId, tenantId },
    include: { expenses: { orderBy: { expenseDate: 'desc' } } },
  });
}

/**
 * Recompute currentBalance as openingBalance minus the sum of linked expenses
 * (foundational balance equation, doc 36 Step 4 / doc 39).
 */
export async function recomputeCurrentBalance(tenantId: string, fundId: string) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: fundId, tenantId } });
  if (!fund) return;

  const agg = await prisma.expense.aggregate({
    where: { tenantId, pettyCashFundId: fundId },
    _sum: { amount: true },
  });
  const spent = agg._sum.amount ? new Decimal(agg._sum.amount.toNumber()) : new Decimal(0);
  const currentBalance = new Decimal(fund.openingBalance.toNumber()).minus(spent).toNumber();

  await prisma.pettyCashFund.update({
    where: { id: fundId },
    data: { currentBalance },
  });
}

/**
 * Compute the balance equation components (doc 39): opening allocation, total
 * logged expenses, and remaining balance. The equation is:
 *   Opening Balance − Total Logged Expenses = Current Balance
 * Returns components so the UI can render the full equation explicitly.
 */
export async function getBalanceEquation(
  tenantId: string,
  fundId: string,
): Promise<BalanceEquation | null> {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: fundId, tenantId } });
  if (!fund) return null;

  const agg = await prisma.expense.aggregate({
    where: { tenantId, pettyCashFundId: fundId },
    _sum: { amount: true },
  });
  const totalExpenses = agg._sum.amount ? agg._sum.amount.toNumber() : 0;
  const currentBalance = new Decimal(fund.openingBalance.toNumber())
    .minus(totalExpenses)
    .toNumber();

  return {
    openingBalance: fund.openingBalance.toNumber(),
    totalExpenses,
    currentBalance,
  };
}

/**
 * Decide whether to fire, clear, or skip a low-balance alert for a fund (doc 40).
 * Pure logic so it is easy to unit test. Suppresses repeat alerts: once alerted,
 * we only re-alert after the balance recovers above the threshold again.
 *
 * @param currentBalance  the computed fund balance (from the equation)
 * @param threshold       the configured low-balance threshold, or null if unset
 * @param lowBalanceAlerted whether the fund is currently in the "alerted" state
 */
export function evaluateLowBalance(
  currentBalance: number,
  threshold: number | null | undefined,
  lowBalanceAlerted: boolean,
): LowBalanceAction {
  if (threshold === null || threshold === undefined) return 'none';
  const below = currentBalance <= threshold;
  if (below && lowBalanceAlerted) return 'none'; // already alerted, suppress
  if (below) return 'fire';
  if (lowBalanceAlerted) return 'clear'; // recovered above threshold
  return 'none';
}

/**
 * Evaluate a fund against its low-balance threshold and emit a PETTY_CASH_LOW
 * notification to the owner (and managers) when it drops to/below the threshold.
 * Also clears the alerted state once the balance recovers. Non-blocking: the
 * caller may await or fire-and-forget.
 */
export async function checkFundLowBalance(tenantId: string, fundId: string) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: fundId, tenantId } });
  if (!fund) return;

  const balance = await getBalanceEquation(tenantId, fundId);
  if (!balance) return;

  const threshold = fund.lowBalanceThreshold ? fund.lowBalanceThreshold.toNumber() : null;
  const action = evaluateLowBalance(balance.currentBalance, threshold, fund.lowBalanceAlerted);

  if (action === 'none') return;

  if (action === 'clear') {
    await prisma.pettyCashFund.update({
      where: { id: fundId },
      data: { lowBalanceAlerted: false },
    });
    return;
  }

  // Fire: target owner + managers so top-up decisions are surfaced promptly.
  const recipients = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ['OWNER', 'MANAGER'] },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (recipients.length > 0) {
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type: 'PETTY_CASH_LOW' as NotificationType,
        title: 'Petty cash running low',
        body: `${fund.name} has a balance of ${balance.currentBalance.toFixed(
          2,
        )} ${fund.currency}, at or below the threshold of ${threshold?.toFixed(2) ?? 'n/a'} ${fund.currency}. Please top up.`,
        relatedEntityType: 'PettyCashFund',
        relatedEntityId: fundId,
      })),
    });
  }

  await prisma.pettyCashFund.update({
    where: { id: fundId },
    data: { lowBalanceAlerted: true, lastLowAlertAt: new Date() },
  });
}

/**
 * Scan all active funds and emit low-balance alerts where needed (doc 40 Step 4).
 * Cron entrypoint for the scheduled resilient scan.
 */
export async function scanPettyCashLowBalances() {
  const funds = await prisma.pettyCashFund.findMany({
    where: { isActive: true },
    select: { id: true, tenantId: true },
  });

  let alerted = 0;
  for (const fund of funds) {
    const before = await prisma.pettyCashFund.findFirst({
      where: { id: fund.id, tenantId: fund.tenantId },
      select: { lowBalanceAlerted: true },
    });
    await checkFundLowBalance(fund.tenantId, fund.id);
    const after = await prisma.pettyCashFund.findFirst({
      where: { id: fund.id, tenantId: fund.tenantId },
      select: { lowBalanceAlerted: true },
    });
    if (after?.lowBalanceAlerted && !before?.lowBalanceAlerted) alerted += 1;
  }

  return { fundsScanned: funds.length, alerted };
}

/**
 * Build the structured dataset for the petty-cash audit-trail export (doc 41):
 * balance components (doc 39), categorized expense totals (doc 37), and receipt
 * references (doc 38). The dataset is serialized by the caller.
 */
export async function buildPettyCashExportData(
  tenantId: string,
  filters: PettyCashExportFilters,
): Promise<PettyCashExportData | null> {
  const fund = await prisma.pettyCashFund.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!fund) return null;

  const where: Record<string, unknown> = { tenantId, pettyCashFundId: fund.id };
  if (filters.category) where.category = filters.category as ExpenseCategory;

  const dateFilter: Record<string, Date> = {};
  if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
  if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo);
  if (Object.keys(dateFilter).length > 0) where.expenseDate = dateFilter;

  const expenses = await prisma.expense.findMany({
    where,
    include: { recordedBy: { select: { email: true } } },
    orderBy: { expenseDate: 'desc' },
  });

  const byCategory: ExpenseCategoryTotal[] = [];
  const categoryMap = new Map<ExpenseCategory, ExpenseCategoryTotal>();
  for (const e of expenses) {
    const cat = e.category as ExpenseCategory;
    const entry = categoryMap.get(cat) ?? { category: cat, count: 0, total: 0 };
    entry.count += 1;
    entry.total += e.amount.toNumber();
    categoryMap.set(cat, entry);
  }
  for (const entry of categoryMap.values()) byCategory.push(entry);
  byCategory.sort((a, b) => b.total - a.total);

  const agg = await prisma.expense.aggregate({ where, _sum: { amount: true } });
  const totalExpenses = agg._sum.amount ? agg._sum.amount.toNumber() : 0;

  return {
    fund: {
      id: fund.id,
      name: fund.name,
      currency: fund.currency,
      openingBalance: fund.openingBalance.toNumber(),
      currentBalance: fund.currentBalance.toNumber(),
      lowBalanceThreshold: fund.lowBalanceThreshold
        ? fund.lowBalanceThreshold.toNumber()
        : null,
    },
    balance: {
      openingBalance: fund.openingBalance.toNumber(),
      totalExpenses,
      currentBalance: new Decimal(fund.openingBalance.toNumber())
        .minus(totalExpenses)
        .toNumber(),
    },
    expenses: expenses.map((e) => ({
      id: e.id,
      expenseDate: e.expenseDate.toISOString(),
      category: e.category as ExpenseCategory,
      description: e.description,
      amount: e.amount.toNumber(),
      receiptImageUrl: e.receiptImageUrl,
      recordedByEmail: e.recordedBy.email,
    })),
    byCategory,
  };
}

/**
 * Apply a spend delta (in LKR) to a fund's current balance. Called when a linked
 * expense is created/updated/deleted so the running balance stays in sync.
 */
export async function adjustFundBalance(
  tenantId: string,
  fundId: string,
  delta: number,
) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: fundId, tenantId } });
  if (!fund) return;

  const next = new Decimal(fund.currentBalance.toNumber()).plus(delta);
  await prisma.pettyCashFund.update({
    where: { id: fundId },
    data: { currentBalance: next.toNumber() },
  });

  // After any spend, re-evaluate the low-balance threshold (doc 40).
  await checkFundLowBalance(tenantId, fundId);
}

/**
 * Update fund configuration: name, opening balance (which recomputes the running
 * current balance), low-balance threshold, active categories, and active state.
 */
export async function updateFund(
  tenantId: string,
  fundId: string,
  data: UpdateFundInput,
  actorId: string,
) {
  const existing = await prisma.pettyCashFund.findFirst({ where: { id: fundId, tenantId } });
  if (!existing) {
    throw new Error('Petty cash fund not found');
  }

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.openingBalance !== undefined) patch.openingBalance = data.openingBalance;
  if (data.lowBalanceThreshold !== undefined) {
    patch.lowBalanceThreshold = data.lowBalanceThreshold;
  }
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (data.activeCategories !== undefined) patch.activeCategories = data.activeCategories;

  const updated = await prisma.pettyCashFund.update({
    where: { id: fundId },
    data: patch,
  });

  // Recompute the running balance whenever the opening allocation changes.
  if (data.openingBalance !== undefined) {
    await recomputeCurrentBalance(tenantId, fundId);
    await checkFundLowBalance(tenantId, fundId);
  }

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'PettyCashFund',
    entityId: fundId,
    action: AUDIT_ACTIONS.PETTY_CASH_FUND_UPDATED,
    before: {
      name: existing.name,
      openingBalance: existing.openingBalance.toNumber(),
      isActive: existing.isActive,
    },
    after: { name: updated.name, openingBalance: updated.openingBalance.toNumber() },
  }).catch(() => {});

  return prisma.pettyCashFund.findFirst({
    where: { id: fundId, tenantId },
    include: { expenses: { orderBy: { expenseDate: 'desc' } } },
  });
}
