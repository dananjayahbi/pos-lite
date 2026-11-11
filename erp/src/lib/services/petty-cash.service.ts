import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import {
  PaymentAccountType,
  PaymentEntrySource,
  type ExpenseCategory,
  type NotificationType,
  type Prisma,
} from '@/generated/prisma/client';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { ApiError } from '@/lib/api/errors';
import { assertSufficientFunds, postLedgerEntries } from '@/lib/services/paymentAccount.service';
import type { TopUpPettyCashInput } from '@/lib/validators/petty-cash.validators';

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
  totalTopUps: number;
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

/** Note shown on the auto-created payment account card. */
const PETTY_CASH_ACCOUNT_NOTE = 'Default petty cash account — managed from Petty Cash.';

/**
 * Ledger sources that represent money entering the petty-cash account.
 * `CLOSING_TRANSFER` is included so a closed account swept into petty cash is
 * counted by the balance equation (it is real cash in), and `FUND_TRANSFER`
 * covers both the Add Cash In dialog and a payment-account transfer.
 */
const TOP_UP_SOURCES = [
  PaymentEntrySource.DEPOSIT,
  PaymentEntrySource.FUND_TRANSFER,
  PaymentEntrySource.CLOSING_TRANSFER,
] as const;

/**
 * Description shown in the Linked Expenses table and the account book.
 * A user note wins; otherwise name the source account (e.g. "Bank") so the
 * row reads "Petty Cash Replenished from Bank".
 */
export function buildTopUpDescription(
  sourceName?: string | null,
  note?: string | null,
): string {
  const clean = note?.trim();
  if (clean) return clean.slice(0, 200);
  return sourceName
    ? `Petty Cash Replenished from ${sourceName}`.slice(0, 200)
    : 'Petty Cash Replenished';
}

// ── Service ─────────────────────────────────────────────────────────────────

/** Resolve an actor for service calls that can run outside a request hook. */
async function resolveActorId(tenantId: string, actorId?: string): Promise<string> {
  if (actorId) return actorId;
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', isActive: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) {
    throw new ApiError(
      500,
      'INTERNAL_SERVER_ERROR',
      'No user is available to own the petty cash payment account',
    );
  }
  return owner.id;
}

/**
 * Give every already-linked expense a matching EXPENSE ledger entry. This makes
 * legacy/seeded expenses editable and deletable without desynchronising the
 * payment account, because the reversal path can find the original entry.
 */
async function backfillLinkedExpenseEntries(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorId: string,
  fundId: string,
  accountId: string,
) {
  const expenses = await tx.expense.findMany({
    where: { tenantId, pettyCashFundId: fundId },
    select: {
      id: true,
      amount: true,
      category: true,
      description: true,
      expenseDate: true,
    },
  });
  if (expenses.length === 0) return;

  const existing = await tx.paymentAccountEntry.findMany({
    where: {
      tenantId,
      accountId,
      source: PaymentEntrySource.EXPENSE,
      sourceId: { in: expenses.map((expense) => expense.id) },
    },
    select: { sourceId: true },
  });
  const alreadyPosted = new Set(existing.map((entry) => entry.sourceId));

  const lines = expenses
    .filter((expense) => !alreadyPosted.has(expense.id))
    .map((expense) => ({
      accountId,
      source: PaymentEntrySource.EXPENSE,
      sourceId: expense.id,
      description: `${expense.category} — ${expense.description}`.slice(0, 200),
      credit: expense.amount,
      entryDate: expense.expenseDate,
    }));

  if (lines.length > 0) {
    await postLedgerEntries(tx, tenantId, actorId, lines, {
      allowPettyCashAccount: true,
    });
  }
}

/**
 * Ensure the fund has its default CASH payment account and that the account
 * balance matches the fund. Called lazily from the petty-cash page and from
 * expense creation so /payment-accounts always shows the float.
 */
export async function ensureFundPaymentAccount(
  tenantId: string,
  fundId: string,
  actorId?: string,
) {
  const fund = await prisma.pettyCashFund.findFirst({
    where: { id: fundId, tenantId },
    include: { paymentAccount: true },
  });
  if (!fund) throw new ApiError(404, 'NOT_FOUND', 'Petty cash fund not found');
  if (fund.paymentAccount) return fund.paymentAccount;

  const actor = await resolveActorId(tenantId, actorId);

  const byName = await prisma.paymentAccount.findFirst({
    where: { tenantId, name: fund.name },
    include: { pettyCashFund: { select: { id: true } } },
  });
  if (byName?.pettyCashFund && byName.pettyCashFund.id !== fund.id) {
    throw new ApiError(
      409,
      'CONFLICT',
      `A payment account named "${fund.name}" is already linked to another petty-cash fund`,
    );
  }

  const account = await prisma.$transaction(async (tx) => {
    const created = !byName;
    const target =
      byName ??
      (await tx.paymentAccount.create({
        data: {
          tenantId,
          name: fund.name,
          type: PaymentAccountType.CASH,
          note: PETTY_CASH_ACCOUNT_NOTE,
          createdById: actor,
        },
        include: { pettyCashFund: { select: { id: true } } },
      }));

    await tx.pettyCashFund.update({
      where: { id: fund.id },
      data: { paymentAccountId: target.id },
    });

    // A new account starts from the fund's original allocation, then every
    // already-linked expense is posted so history and future edits reconcile.
    if (created && fund.openingBalance.greaterThan(0)) {
      await postLedgerEntries(
        tx,
        tenantId,
        actor,
        [
          {
            accountId: target.id,
            source: PaymentEntrySource.OPENING_BALANCE,
            description: 'Petty Cash Opening Balance',
            debit: fund.openingBalance,
          },
        ],
        { allowPettyCashAccount: true },
      );
    }

    await backfillLinkedExpenseEntries(tx, tenantId, actor, fund.id, target.id);

    // Any remaining difference (pre-existing account history, top-ups, or
    // legacy data) is reconciled once with an explicit adjustment.
    const refreshed = await tx.paymentAccount.findFirst({
      where: { id: target.id, tenantId },
      select: { balance: true },
    });
    const targetBalance = new Decimal(fund.currentBalance.toString());
    const diff = targetBalance.minus(refreshed?.balance.toString() ?? '0');
    if (!diff.isZero()) {
      await postLedgerEntries(
        tx,
        tenantId,
        actor,
        [
          {
            accountId: target.id,
            source: PaymentEntrySource.ADJUSTMENT,
            description: 'Petty cash balance sync',
            ...(diff.greaterThan(0) ? { debit: diff } : { credit: diff.abs() }),
          },
        ],
        { allowPettyCashAccount: true },
      );
    }

    return tx.paymentAccount.findFirst({ where: { id: target.id, tenantId } });
  });

  if (!account) {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Petty cash payment account could not be linked');
  }

  void createAuditLog({
    tenantId,
    actorId: actor,
    actorRole: 'USER',
    entityType: 'PettyCashFund',
    entityId: fund.id,
    action: AUDIT_ACTIONS.PETTY_CASH_FUND_UPDATED,
    after: { paymentAccountId: account.id, paymentAccountName: account.name },
  }).catch(() => {});

  return account;
}

/**
 * Ensure an existing fund's payment account exists without creating a fund.
 * Used by the payment-accounts list so the default petty-cash account appears
 * there even before the petty-cash page has been opened.
 */
export async function ensureDefaultPettyCashPaymentAccount(
  tenantId: string,
  actorId: string,
) {
  const fund = await prisma.pettyCashFund.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!fund) return;
  try {
    await ensureFundPaymentAccount(tenantId, fund.id, actorId);
  } catch (error) {
    // A name collision or legacy bad row must not take the whole payment
    // accounts list down; the petty-cash page still surfaces the error.
    console.error('ensureDefaultPettyCashPaymentAccount failed:', error);
  }
}

/**
 * Return the standalone petty-cash fund for a tenant, lazily creating a default
 * fund if none exists (doc 36). One fund per store keeps the float accountable.
 * The fund is always backed by a default CASH payment account.
 */
export async function getOrCreateFund(tenantId: string, actorId?: string) {
  const existing = await prisma.pettyCashFund.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  let fund = existing;
  if (!fund) {
    fund = await prisma.pettyCashFund.create({
      data: {
        tenantId,
        name: 'Main Petty Cash',
        openingBalance: 0,
        currentBalance: 0,
        lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
        activeCategories: DEFAULT_CATEGORIES,
      },
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
  }

  await ensureFundPaymentAccount(tenantId, fund.id, actorId);

  return prisma.pettyCashFund.findFirst({
    where: { id: fund.id },
    include: {
      expenses: { orderBy: { expenseDate: 'desc' }, take: 20 },
      paymentAccount: true,
    },
  });
}

/** Fetch a fund by id (tenant-scoped) with its linked expenses and account. */
export async function getFund(tenantId: string, fundId: string) {
  return prisma.pettyCashFund.findFirst({
    where: { id: fundId, tenantId },
    include: {
      expenses: { orderBy: { expenseDate: 'desc' } },
      paymentAccount: true,
    },
  });
}

/** Sum ledger debits that represent money added to the petty-cash account. */
async function sumTopUps(
  tenantId: string,
  fund: { paymentAccountId: string | null },
): Promise<Decimal> {
  if (!fund.paymentAccountId) return new Decimal(0);
  const agg = await prisma.paymentAccountEntry.aggregate({
    where: {
      tenantId,
      accountId: fund.paymentAccountId,
      source: { in: [...TOP_UP_SOURCES] },
      debit: { gt: 0 },
    },
    _sum: { debit: true },
  });
  return new Decimal(agg._sum.debit?.toString() ?? '0');
}

/**
 * Recompute currentBalance as openingBalance + top-ups − linked expenses
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
  const topUps = await sumTopUps(tenantId, fund);
  const currentBalance = new Decimal(fund.openingBalance.toNumber())
    .plus(topUps)
    .minus(spent)
    .toNumber();

  await prisma.pettyCashFund.update({
    where: { id: fundId },
    data: { currentBalance },
  });
}

/**
 * Compute the balance equation components (doc 39): opening allocation,
 * top-ups, total logged expenses, and remaining balance. The equation is:
 *   Opening Balance + Top-ups − Total Logged Expenses = Current Balance
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
  const totalTopUps = (await sumTopUps(tenantId, fund)).toNumber();
  const currentBalance = new Decimal(fund.openingBalance.toNumber())
    .plus(totalTopUps)
    .minus(totalExpenses)
    .toNumber();

  return {
    openingBalance: fund.openingBalance.toNumber(),
    totalTopUps,
    totalExpenses,
    currentBalance,
  };
}

/** One "cash in" row for the petty-cash Linked Expenses table. */
export interface PettyCashTopUpRow {
  id: string;
  entryDate: string;
  description: string;
  amount: string;
}

/**
 * List the ledger debits that represent top-ups into the petty-cash account.
 * The ledger is the transaction record, so no extra table is needed: every
 * Add Cash In call writes one of these rows.
 */
export async function getPettyCashTopUps(
  tenantId: string,
  fund: { paymentAccountId: string | null },
): Promise<PettyCashTopUpRow[]> {
  if (!fund.paymentAccountId) return [];

  const entries = await prisma.paymentAccountEntry.findMany({
    where: {
      tenantId,
      accountId: fund.paymentAccountId,
      source: { in: [...TOP_UP_SOURCES] },
      debit: { gt: 0 },
    },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: { id: true, entryDate: true, description: true, debit: true },
  });

  return entries.map((entry) => ({
    id: entry.id,
    entryDate: entry.entryDate.toISOString(),
    description: entry.description,
    amount: entry.debit.toFixed(2),
  }));
}

/**
 * Add cash to the petty-cash fund.
 *
 * The fund balance, the petty-cash payment account, and (when a source account
 * is chosen) the source account are all updated in one transaction. A source
 * account turns the top-up into a fund transfer; omitting it records an
 * external deposit. The ledger entry doubles as the transaction row shown in
 * the Linked Expenses table.
 */
export async function topUpPettyCash(
  tenantId: string,
  actorId: string,
  actorRole: string,
  input: TopUpPettyCashInput,
) {
  const fund = await getOrCreateFund(tenantId, actorId);
  const fundAccountId = fund?.paymentAccountId;
  if (!fundAccountId) {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Petty cash payment account is not configured');
  }

  const amount = new Decimal(input.amount);
  const groupId = `pc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const entryDate = input.entryDate;

  const result = await prisma.$transaction(async (tx) => {
    let sourceName: string | null = null;

    if (input.sourceAccountId) {
      const source = await tx.paymentAccount.findFirst({
        where: { id: input.sourceAccountId, tenantId },
        include: { pettyCashFund: { select: { id: true } } },
      });
      if (!source) {
        throw new ApiError(404, 'NOT_FOUND', 'Source payment account not found');
      }
      if (source.id === fundAccountId) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Choose a different source account');
      }
      if (source.pettyCashFund) {
        throw new ApiError(409, 'CONFLICT', 'Source account is another petty-cash account');
      }

      await assertSufficientFunds(tx, tenantId, source.id, amount);
      sourceName = source.name;

      await postLedgerEntries(
        tx,
        tenantId,
        actorId,
        [
          {
            accountId: source.id,
            source: PaymentEntrySource.FUND_TRANSFER,
            sourceId: groupId,
            transferGroupId: groupId,
            description: `Petty Cash Replenishment — ${fund.name}`.slice(0, 200),
            credit: amount,
            ...(entryDate !== undefined ? { entryDate } : {}),
          },
          {
            accountId: fundAccountId,
            source: PaymentEntrySource.FUND_TRANSFER,
            sourceId: groupId,
            transferGroupId: groupId,
            description: buildTopUpDescription(source.name, input.description),
            debit: amount,
            ...(entryDate !== undefined ? { entryDate } : {}),
          },
        ],
        { allowPettyCashAccount: true },
      );
    } else {
      await postLedgerEntries(
        tx,
        tenantId,
        actorId,
        [
          {
            accountId: fundAccountId,
            source: PaymentEntrySource.DEPOSIT,
            sourceId: groupId,
            transferGroupId: groupId,
            description: buildTopUpDescription(null, input.description),
            debit: amount,
            ...(entryDate !== undefined ? { entryDate } : {}),
          },
        ],
        { allowPettyCashAccount: true },
      );
    }

    const updated = await tx.pettyCashFund.update({
      where: { id: fund.id },
      data: { currentBalance: { increment: amount.toNumber() } },
    });

    return {
      fund: updated,
      amount: amount.toNumber(),
      description: buildTopUpDescription(sourceName, input.description),
      sourceAccountId: input.sourceAccountId ?? null,
    };
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole,
    entityType: 'PettyCashFund',
    entityId: fund.id,
    action: AUDIT_ACTIONS.PETTY_CASH_TOP_UP,
    after: {
      amount: amount.toNumber(),
      sourceAccountId: input.sourceAccountId ?? null,
      description: result.description,
    },
  }).catch(() => {});

  // A top-up can lift the fund back above its threshold and clear the alert.
  await checkFundLowBalance(tenantId, fund.id);

  return result;
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
  const totalTopUps = (await sumTopUps(tenantId, fund)).toNumber();

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
      totalTopUps,
      totalExpenses,
      currentBalance: new Decimal(fund.openingBalance.toNumber())
        .plus(totalTopUps)
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

/** Sentinel thrown when a linked expense would push a fund below zero (M19-01). */
export const PETTY_CASH_OVERDRAW_SENTINEL = 'Petty cash fund cannot go negative';

/**
 * M19-01 (BUG-53, decision D2) — guard a spend against the fund's live balance.
 *
 * Policy D2 = (b): an overdraft is BLOCKED by default (typed 422), and is only
 * allowed when the caller explicitly passes `overdrawApproved` AND holds a
 * manager-ish permission. Throws the `PETTY_CASH_OVERDRAW_SENTINEL` message so
 * the shared error mapper (INF-02) can turn it into a typed 422 rather than a
 * raw 500; the approval path is audited by the caller.
 *
 * @param amount the spend being applied (positive LKR)
 * @param approved explicit manager approval (already permission-checked)
 */
export async function assertFundCanSpend(
  tenantId: string,
  fundId: string,
  amount: number,
  approved: boolean,
  credit = 0,
) {
  if (approved) return;
  const fund = await prisma.pettyCashFund.findFirst({
    where: { id: fundId, tenantId },
    select: { currentBalance: true },
  });
  if (!fund) return;
  // `credit` lets an EDIT re-check net of the old linked amount it is replacing.
  const next = new Decimal(fund.currentBalance.toNumber()).plus(credit).minus(amount);
  if (next.lessThan(0)) {
    throw new Error(
      `${PETTY_CASH_OVERDRAW_SENTINEL}: expense of ${amount.toFixed(2)} exceeds the available balance of ${new Decimal(fund.currentBalance.toNumber()).plus(credit).toNumber().toFixed(2)}`,
    );
  }
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
    throw new ApiError(404, 'NOT_FOUND', 'Petty cash fund not found');
  }

  if (data.name !== undefined && existing.paymentAccountId) {
    const clash = await prisma.paymentAccount.findFirst({
      where: { tenantId, name: data.name, id: { not: existing.paymentAccountId } },
      select: { id: true },
    });
    if (clash) {
      throw new ApiError(409, 'CONFLICT', `A payment account named "${data.name}" already exists`);
    }
  }

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.openingBalance !== undefined) patch.openingBalance = data.openingBalance;
  if (data.lowBalanceThreshold !== undefined) {
    patch.lowBalanceThreshold = data.lowBalanceThreshold;
  }
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (data.activeCategories !== undefined) patch.activeCategories = data.activeCategories;

  // Keep the linked payment account name aligned with the fund name.
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.pettyCashFund.update({
      where: { id: fundId },
      data: patch,
    });
    if (data.name !== undefined && existing.paymentAccountId) {
      await tx.paymentAccount.update({
        where: { id: existing.paymentAccountId },
        data: { name: data.name },
      });
    }
    return next;
  });

  // Recompute the running balance whenever the opening allocation changes.
  // The legacy openingBalance path is no longer exposed in the UI, but if an
  // owner calls it we keep the linked account in step with the new allocation.
  if (data.openingBalance !== undefined) {
    const beforeCurrent = new Decimal(existing.currentBalance.toString());
    await recomputeCurrentBalance(tenantId, fundId);
    const afterFund = await prisma.pettyCashFund.findFirst({
      where: { id: fundId, tenantId },
      select: { currentBalance: true },
    });
    const delta = new Decimal(afterFund?.currentBalance.toString() ?? '0').minus(beforeCurrent);
    const accountId = existing.paymentAccountId;
    if (!delta.isZero() && accountId) {
      await prisma.$transaction(async (tx) => {
        await postLedgerEntries(
          tx,
          tenantId,
          actorId,
          [
            {
              accountId,
              source: PaymentEntrySource.ADJUSTMENT,
              description: 'Petty cash opening balance adjustment',
              ...(delta.greaterThan(0) ? { debit: delta } : { credit: delta.abs() }),
            },
          ],
          { allowPettyCashAccount: true },
        );
      });
    }
    await checkFundLowBalance(tenantId, fundId);
  } else if (data.lowBalanceThreshold !== undefined) {
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
    include: {
      expenses: { orderBy: { expenseDate: 'desc' } },
      paymentAccount: true,
    },
  });
}
