import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import type { ExpenseCategory, Prisma } from '@/generated/prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@/lib/validators/expense.validators';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  adjustFundBalanceTx,
  checkFundLowBalance,
  ensureFundPaymentAccount,
  lockFundRows,
} from '@/lib/services/petty-cash.service';
import { PaymentEntrySource } from '@/generated/prisma/client';
import { assertSufficientFunds, postLedgerEntries } from '@/lib/services/paymentAccount.service';
import { parseRangeStart, parseRangeEnd } from '@/lib/dates/inclusiveRange';
import { lockForUpdate } from '@/lib/api/race-guard';
import { ApiError } from '@/lib/api/errors';
import { categoryDenialReason } from '@/lib/petty-cash/category-policy';
import { resolveExpenseLinkUpdate } from '@/lib/expenses/link';
import { expenseAuditSnapshot, expenseChangedFields } from '@/lib/expenses/audit';

interface ExpenseFilters {
  category?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

const expenseRelations = {
  recordedBy: { select: { email: true } },
  // ARGUS #399: the Account column needs the fund name when the spend is
  // settled through a petty-cash fund rather than a named payment account.
  paymentAccount: { select: { id: true, name: true } },
  pettyCashFund: { select: { id: true, name: true } },
} as const;

/**
 * ARGUS #401 - expense audits commit with the expense/ledger write instead of
 * being fire-and-forget. A failed audit write rolls the whole operation back,
 * so the financial history can never be missing a mutation it describes.
 */
async function writeExpenseAudit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorId: string;
    action: string;
    entityType?: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorRole: 'USER',
      entityType: input.entityType ?? 'Expense',
      entityId: input.entityId,
      action: input.action,
      ...(input.before !== undefined ? { before: input.before } : {}),
      ...(input.after !== undefined ? { after: input.after } : {}),
    },
  });
}

function asJson(snapshot: unknown): Prisma.InputJsonValue {
  return snapshot as Prisma.InputJsonValue;
}

/**
 * ARGUS #403 - lock the payment accounts an expense touches before locking its
 * fund(s). Sorted ids keep opposite-direction edits deadlock-free; the fund
 * service uses the same account -> fund order for top-ups and transfers.
 */
async function lockExpenseAccounts(
  tx: Prisma.TransactionClient,
  tenantId: string,
  accountIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids = Array.from(
    new Set(accountIds.filter((id): id is string => Boolean(id))),
  ).sort();
  for (const id of ids) {
    await lockForUpdate(
      tx,
      'payment_accounts',
      '"id" = $1 AND "tenantId" = $2',
      [id, tenantId],
    );
  }
}

async function recheckFundsLowBalance(tenantId: string, fundIds: readonly (string | null)[]) {
  const ids = Array.from(new Set(fundIds.filter((id): id is string => Boolean(id))));
  for (const id of ids) {
    try {
      await checkFundLowBalance(tenantId, id);
    } catch (error) {
      // The money movement already committed; an alert failure must not turn a
      // successful expense write into a 500.
      console.error('Petty cash low-balance check failed:', id, error);
    }
  }
}

function buildExpenseWhere(tenantId: string, filters: ExpenseFilters): Record<string, unknown> {
  const where: Record<string, unknown> = { tenantId };

  if (filters.category) {
    where.category = filters.category as ExpenseCategory;
  }

  const dateFilter: Record<string, Date> = {};
  if (filters.dateFrom) {
    dateFilter.gte = parseRangeStart(filters.dateFrom);
  }
  if (filters.dateTo) {
    dateFilter.lte = parseRangeEnd(filters.dateTo);
  }
  if (Object.keys(dateFilter).length > 0) {
    where.expenseDate = dateFilter;
  }

  return where;
}

export async function getExpenses(tenantId: string, filters: ExpenseFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where = buildExpenseWhere(tenantId, filters);

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: expenseRelations,
      orderBy: { expenseDate: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, page, pageSize };
}

/**
 * ARGUS #396: the full register for a CSV download. Same filters as the list
 * (category and inclusive date range) but every matching row, across every
 * account and petty-cash fund, with no pagination.
 */
export async function getExpensesForExport(
  tenantId: string,
  filters: Omit<ExpenseFilters, 'page' | 'pageSize'>,
) {
  return prisma.expense.findMany({
    where: buildExpenseWhere(tenantId, filters),
    include: expenseRelations,
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getExpenseById(tenantId: string, id: string) {
  return prisma.expense.findFirst({
    where: { id, tenantId },
    include: expenseRelations,
  });
}

/**
 * Reverse the EXPENSE ledger lines for an expense being edited or deleted.
 * Reversals are new ADJUSTMENT entries (the ledger is append-only); the
 * originating `sourceId` keeps them linked to the expense.
 */
async function reverseExpenseLedger(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorId: string,
  expenseId: string,
  description: string,
): Promise<void> {
  const entries = await tx.paymentAccountEntry.findMany({
    where: {
      tenantId,
      source: PaymentEntrySource.EXPENSE,
      sourceId: expenseId,
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const lines = entries
    .map((entry) => {
      const net = new Decimal(entry.debit.toString()).minus(entry.credit.toString());
      if (net.isZero()) return null;
      return {
        accountId: entry.accountId,
        source: PaymentEntrySource.ADJUSTMENT,
        sourceId: expenseId,
        description: `Expense reversal - ${description}`.slice(0, 200),
        ...(net.greaterThan(0)
          ? { credit: net }
          : { debit: net.abs() }),
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (lines.length > 0) {
    await postLedgerEntries(tx, tenantId, actorId, lines, {
      allowPettyCashAccount: true,
    });
  }
}

export async function createExpense(
  tenantId: string,
  data: CreateExpenseInput & { recordedById: string; overdrawApproved?: boolean | undefined },
) {
  // Resolve the payment account and petty-cash fund as a pair. A fund always
  // settles through its own account; an account linked to a fund implies the
  // fund link. This keeps the fund, the account book, and the Cash Flow report
  // on the same numbers.
  let effectiveFundId = data.pettyCashFundId ?? null;
  let effectiveAccountId = data.paymentAccountId ?? null;
  let effectiveFundCategories: string[] | null = null;

  if (effectiveFundId) {
    const fund = await prisma.pettyCashFund.findFirst({
      where: { id: effectiveFundId, tenantId },
      select: { paymentAccountId: true, activeCategories: true },
    });
    if (!fund) throw new Error('Petty cash fund not found');
    effectiveFundCategories = fund.activeCategories;
    effectiveAccountId = fund.paymentAccountId
      ? fund.paymentAccountId
      : (await ensureFundPaymentAccount(tenantId, effectiveFundId, data.recordedById)).id;
  } else if (effectiveAccountId) {
    const account = await prisma.paymentAccount.findFirst({
      where: { id: effectiveAccountId, tenantId },
      include: {
        pettyCashFund: { select: { id: true, activeCategories: true } },
      },
    });
    if (!account) throw new Error('Payment account not found');
    if (account.pettyCashFund) {
      effectiveFundId = account.pettyCashFund.id;
      effectiveFundCategories = account.pettyCashFund.activeCategories;
    }
  }

  // ARGUS #407: the fund's Active Categories are enforced server-side. This
  // runs before any row/ledger write so a disabled category cannot be smuggled
  // in through the API or a stale form.
  if (effectiveFundId) {
    const denial = categoryDenialReason(data.category, effectiveFundCategories);
    if (denial) {
      throw new ApiError(422, 'CATEGORY_NOT_ENABLED', denial);
    }
  }

  // M19-01/#403: the overdraw check and fund deduction happen under the fund
  // row lock inside the transaction below, not in an unlocked pre-check.

  const expense = await prisma.$transaction(async (tx) => {
    // Consistent lock order with top-ups/transfers: payment account first,
    // then the fund. Sorted ids make multi-account cases deadlock-free.
    await lockExpenseAccounts(tx, tenantId, [effectiveAccountId]);
    if (effectiveFundId) {
      await lockFundRows(tx, tenantId, [effectiveFundId]);
      // Re-reads the balance under the lock. If another spend won the race this
      // throws and no expense/ledger row is written.
      await adjustFundBalanceTx(tx, tenantId, effectiveFundId, -data.amount, {
        enforceNonNegative: true,
        approved: data.overdrawApproved === true,
      });
    }

    const created = await tx.expense.create({
      data: {
        tenantId,
        category: data.category as ExpenseCategory,
        amount: data.amount,
        description: data.description,
        expenseDate: new Date(data.expenseDate),
        ...(data.receiptImageUrl !== undefined && { receiptImageUrl: data.receiptImageUrl }),
        ...(effectiveFundId !== null && { pettyCashFundId: effectiveFundId }),
        ...(effectiveAccountId !== null && { paymentAccountId: effectiveAccountId }),
        recordedById: data.recordedById,
      },
      include: { recordedBy: { select: { email: true } } },
    });

    // Settle the expense out of its payment account in the SAME transaction as
    // the expense row. If the account is closed or short of funds, nothing is
    // written — previously the expense could exist without its ledger entry.
    if (effectiveAccountId) {
      await assertSufficientFunds(
        tx,
        tenantId,
        effectiveAccountId,
        data.amount,
        data.overdrawApproved === true,
      );
      await postLedgerEntries(
        tx,
        tenantId,
        data.recordedById,
        [
          {
            accountId: effectiveAccountId,
            source: PaymentEntrySource.EXPENSE,
            sourceId: created.id,
            description: `${data.category} - ${data.description}`.slice(0, 200),
            credit: data.amount,
            entryDate: new Date(data.expenseDate),
          },
        ],
        { allowPettyCashAccount: true },
      );
    }

    if (effectiveFundId && data.overdrawApproved === true) {
      await writeExpenseAudit(tx, {
        tenantId,
        actorId: data.recordedById,
        action: 'PETTY_CASH_OVERDRAW_APPROVED',
        entityType: 'PettyCashFund',
        entityId: effectiveFundId,
        after: asJson({ expenseId: created.id, amount: created.amount.toString() }),
      });
    }

    await writeExpenseAudit(tx, {
      tenantId,
      actorId: data.recordedById,
      action: AUDIT_ACTIONS.EXPENSE_CREATED,
      entityId: created.id,
      after: asJson(expenseAuditSnapshot(created)),
    });

    return created;
  });

  // Low-balance evaluation runs after the committed transaction; the money
  // movement itself is already atomic.
  await recheckFundsLowBalance(tenantId, [effectiveFundId]);

  return expense;
}

export async function updateExpense(
  tenantId: string,
  id: string,
  data: UpdateExpenseInput & { overdrawApproved?: boolean | undefined; actorId?: string | undefined },
) {
  const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new Error('Expense not found');
  }

  // Resolve the fund/account pair exactly like createExpense: a fund forces
  // its own account, and choosing a linked account implies its fund.
  const oldFundId = existing.pettyCashFundId;
  const oldAccountId = existing.paymentAccountId;
  const oldAmount = existing.amount.toNumber();

  let effectiveFundId =
    data.pettyCashFundId !== undefined ? data.pettyCashFundId : oldFundId;
  let effectiveAccountId =
    data.paymentAccountId !== undefined ? data.paymentAccountId : oldAccountId;
  let effectiveFundCategories: string[] | null = null;

  // ARGUS #400: an explicit null on either side unlinks the pair; a concrete
  // account still implies its fund below. Without this an omitted fund field
  // kept the old link and "Not linked" silently succeeded.
  {
    const link = resolveExpenseLinkUpdate({
      oldFundId,
      oldAccountId,
      ...(data.pettyCashFundId !== undefined
        ? { pettyCashFundId: data.pettyCashFundId }
        : {}),
      ...(data.paymentAccountId !== undefined
        ? { paymentAccountId: data.paymentAccountId }
        : {}),
    });
    effectiveFundId = link.pettyCashFundId;
    effectiveAccountId = link.paymentAccountId;
  }

  if (effectiveFundId) {
    const fund = await prisma.pettyCashFund.findFirst({
      where: { id: effectiveFundId, tenantId },
      select: { paymentAccountId: true, activeCategories: true },
    });
    if (!fund) throw new Error('Petty cash fund not found');
    effectiveFundCategories = fund.activeCategories;
    effectiveAccountId = fund.paymentAccountId
      ? fund.paymentAccountId
      : (
          await ensureFundPaymentAccount(
            tenantId,
            effectiveFundId,
            data.actorId ?? existing.recordedById,
          )
        ).id;
  } else if (effectiveAccountId) {
    const account = await prisma.paymentAccount.findFirst({
      where: { id: effectiveAccountId, tenantId },
      include: {
        pettyCashFund: { select: { id: true, activeCategories: true } },
      },
    });
    if (!account) throw new Error('Payment account not found');
    if (account.pettyCashFund) {
      effectiveFundId = account.pettyCashFund.id;
      effectiveFundCategories = account.pettyCashFund.activeCategories;
    }
  }

  const newFundId = effectiveFundId;
  const newAccountId = effectiveAccountId;
  const newAmount = data.amount !== undefined ? data.amount : oldAmount;

  // ARGUS #407: enforce the fund allow-list when the update writes a category
  // or moves the expense onto a fund. An untouched category on an existing
  // legacy row stays editable so disabled historical data can still be fixed.
  if (newFundId && (data.category !== undefined || newFundId !== oldFundId)) {
    const nextCategory = data.category ?? existing.category;
    const denial = categoryDenialReason(nextCategory, effectiveFundCategories);
    if (denial) {
      throw new ApiError(422, 'CATEGORY_NOT_ENABLED', denial);
    }
  }

  // M19-01 (D2): an edit that increases or re-links a fund-backed spend is
  // guarded exactly like a create. The actual check runs under the fund row
  // lock inside the transaction (ARGUS #403); this flag only decides whether an
  // approved overdraw needs an audit row.
  const fundCheckRan = Boolean(
    newFundId && (newFundId !== oldFundId || newAmount !== oldAmount),
  );

  const newExpenseDate =
    data.expenseDate !== undefined ? new Date(data.expenseDate) : existing.expenseDate;
  const accountChanged = newAccountId !== oldAccountId;
  const amountChanged = data.amount !== undefined && data.amount !== oldAmount;
  const dateChanged =
    data.expenseDate !== undefined &&
    newExpenseDate.getTime() !== existing.expenseDate.getTime();
  // ARGUS #401: category/description are part of the ledger narrative. Repost
  // the EXPENSE line when either changes, not only when money changes.
  const narrativeChanged =
    (data.category !== undefined && data.category !== existing.category) ||
    (data.description !== undefined && data.description !== existing.description);

  const expense = await prisma.$transaction(async (tx) => {
    // ARGUS #403: lock every account/fund this edit touches before changing
    // anything. Accounts first, then funds, both sorted, so opposite-direction
    // moves cannot deadlock.
    await lockExpenseAccounts(tx, tenantId, [oldAccountId, newAccountId]);
    await lockFundRows(tx, tenantId, [oldFundId, newFundId]);

    const updated = await tx.expense.update({
      where: { id },
      data: {
        ...(data.category !== undefined && { category: data.category as ExpenseCategory }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.expenseDate !== undefined && { expenseDate: new Date(data.expenseDate) }),
        ...(data.receiptImageUrl !== undefined && { receiptImageUrl: data.receiptImageUrl }),
        ...(newFundId !== oldFundId && { pettyCashFundId: newFundId }),
        ...(newAccountId !== oldAccountId && { paymentAccountId: newAccountId }),
      },
      include: { recordedBy: { select: { email: true } } },
    });

    // Keep the payment-account ledger aligned with the edited expense. A changed
    // account/amount/date/category/description reverses the old EXPENSE entries
    // and posts the new amount/narrative, all in the same transaction as the
    // expense row.
    if (accountChanged || amountChanged || dateChanged || narrativeChanged) {
      const actorId = data.actorId ?? existing.recordedById;
      await reverseExpenseLedger(tx, tenantId, actorId, id, existing.description);

      if (newAccountId) {
        await assertSufficientFunds(
          tx,
          tenantId,
          newAccountId,
          newAmount,
          data.overdrawApproved === true,
        );
        await postLedgerEntries(
          tx,
          tenantId,
          actorId,
          [
            {
              accountId: newAccountId,
              source: PaymentEntrySource.EXPENSE,
              sourceId: id,
              description: `${updated.category} - ${updated.description}`.slice(0, 200),
              credit: newAmount,
              entryDate: newExpenseDate,
            },
          ],
          { allowPettyCashAccount: true },
        );
      }
    }

    // ARGUS #403: fund balance moves in the same transaction, under the lock
    // taken above. Same fund = one net delta; moving funds = refund + deduct.
    if (oldFundId && newFundId && oldFundId === newFundId) {
      const delta = oldAmount - newAmount;
      if (delta !== 0) {
        await adjustFundBalanceTx(tx, tenantId, oldFundId, delta, {
          enforceNonNegative: newAmount > oldAmount,
          approved: data.overdrawApproved === true,
        });
      }
    } else {
      if (oldFundId) {
        await adjustFundBalanceTx(tx, tenantId, oldFundId, oldAmount);
      }
      if (newFundId) {
        await adjustFundBalanceTx(tx, tenantId, newFundId, -newAmount, {
          enforceNonNegative: true,
          approved: data.overdrawApproved === true,
        });
      }
    }

    if (fundCheckRan && newFundId && data.overdrawApproved === true) {
      await writeExpenseAudit(tx, {
        tenantId,
        actorId: data.actorId ?? existing.recordedById,
        action: 'PETTY_CASH_OVERDRAW_APPROVED',
        entityType: 'PettyCashFund',
        entityId: newFundId,
        after: asJson({ expenseId: id, amount: newAmount }),
      });
    }

    // ARGUS #401: durable before/after trail for every changed expense.
    const beforeSnapshot = expenseAuditSnapshot(existing);
    const afterSnapshot = expenseAuditSnapshot(updated);
    if (expenseChangedFields(beforeSnapshot, afterSnapshot).length > 0) {
      await writeExpenseAudit(tx, {
        tenantId,
        actorId: data.actorId ?? existing.recordedById,
        action: AUDIT_ACTIONS.EXPENSE_UPDATED,
        entityId: id,
        before: asJson(beforeSnapshot),
        after: asJson(afterSnapshot),
      });
    }

    return updated;
  });

  // Low-balance evaluation runs after the committed transaction; the fund and
  // ledger movement are already atomic.
  await recheckFundsLowBalance(tenantId, [oldFundId, newFundId]);

  return expense;
}

export async function deleteExpense(tenantId: string, id: string, actorId: string) {
  const expense = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!expense) {
    throw new Error('Expense not found');
  }

  await prisma.$transaction(async (tx) => {
    // ARGUS #403: account first, then fund, both locked before any write.
    await lockExpenseAccounts(tx, tenantId, [expense.paymentAccountId]);
    await lockFundRows(tx, tenantId, [expense.pettyCashFundId]);

    await reverseExpenseLedger(
      tx,
      tenantId,
      actorId,
      expense.id,
      expense.description,
    );

    // Refund the fund inside the same transaction; a reversal failure rolls the
    // delete back instead of leaving a desynced balance.
    if (expense.pettyCashFundId) {
      await adjustFundBalanceTx(
        tx,
        tenantId,
        expense.pettyCashFundId,
        expense.amount.toNumber(),
      );
    }

    // ARGUS #401: audit in the same transaction as the reversal/delete. The
    // model has no status/deletedAt field, so a hard delete is the only
    // mechanism available; this audit row is the durable tombstone.
    await writeExpenseAudit(tx, {
      tenantId,
      actorId,
      action: AUDIT_ACTIONS.EXPENSE_DELETED,
      entityId: id,
      before: asJson(expenseAuditSnapshot(expense)),
    });
    await tx.expense.delete({ where: { id } });
  });

  await recheckFundsLowBalance(tenantId, [expense.pettyCashFundId]);
}
