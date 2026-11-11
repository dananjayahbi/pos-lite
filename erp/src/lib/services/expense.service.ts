import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import type { ExpenseCategory, Prisma } from '@/generated/prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@/lib/validators/expense.validators';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  adjustFundBalance,
  assertFundCanSpend,
  ensureFundPaymentAccount,
} from '@/lib/services/petty-cash.service';
import { PaymentEntrySource } from '@/generated/prisma/client';
import { assertSufficientFunds, postLedgerEntries } from '@/lib/services/paymentAccount.service';

interface ExpenseFilters {
  category?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export async function getExpenses(tenantId: string, filters: ExpenseFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { tenantId };

  if (filters.category) {
    where.category = filters.category as ExpenseCategory;
  }

  const dateFilter: Record<string, Date> = {};
  if (filters.dateFrom) {
    dateFilter.gte = new Date(filters.dateFrom);
  }
  if (filters.dateTo) {
    dateFilter.lte = new Date(filters.dateTo);
  }
  if (Object.keys(dateFilter).length > 0) {
    where.expenseDate = dateFilter;
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { recordedBy: { select: { email: true } } },
      orderBy: { expenseDate: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, page, pageSize };
}

export async function getExpenseById(tenantId: string, id: string) {
  return prisma.expense.findFirst({
    where: { id, tenantId },
    include: { recordedBy: { select: { email: true } } },
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
        description: `Expense reversal — ${description}`.slice(0, 200),
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

  if (effectiveFundId) {
    const fund = await prisma.pettyCashFund.findFirst({
      where: { id: effectiveFundId, tenantId },
      select: { paymentAccountId: true },
    });
    if (!fund) throw new Error('Petty cash fund not found');
    effectiveAccountId = fund.paymentAccountId
      ? fund.paymentAccountId
      : (await ensureFundPaymentAccount(tenantId, effectiveFundId, data.recordedById)).id;
  } else if (effectiveAccountId) {
    const account = await prisma.paymentAccount.findFirst({
      where: { id: effectiveAccountId, tenantId },
      include: { pettyCashFund: { select: { id: true } } },
    });
    if (!account) throw new Error('Payment account not found');
    if (account.pettyCashFund) effectiveFundId = account.pettyCashFund.id;
  }

  // M19-01 (BUG-53, D2): block a linked expense that would overdraw the fund
  // unless an explicit (permission-checked) manager approval rode along. Runs
  // BEFORE the row is created so a blocked overdraw writes nothing.
  if (effectiveFundId) {
    await assertFundCanSpend(
      tenantId,
      effectiveFundId,
      data.amount,
      data.overdrawApproved === true,
    );
  }

  const expense = await prisma.$transaction(async (tx) => {
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
            description: `${data.category} — ${data.description}`.slice(0, 200),
            credit: data.amount,
            entryDate: new Date(data.expenseDate),
          },
        ],
        { allowPettyCashAccount: true },
      );
    }

    return created;
  });

  // A linked petty-cash expense reduces the fund's running balance.
  if (effectiveFundId) {
    await adjustFundBalance(tenantId, effectiveFundId, -data.amount);
    // M19-01: an approved overdraft is a privileged exception — audit it with
    // the actor so the audit trail answers "who allowed the negative balance?".
    if (data.overdrawApproved === true) {
      void createAuditLog({
        tenantId,
        actorId: data.recordedById,
        actorRole: 'USER',
        entityType: 'PettyCashFund',
        entityId: effectiveFundId,
        action: 'PETTY_CASH_OVERDRAW_APPROVED',
        after: { expenseId: expense.id, amount: expense.amount },
      }).catch(() => {});
    }
  }

  void createAuditLog({
    tenantId,
    actorId: data.recordedById,
    actorRole: 'USER',
    entityType: 'Expense',
    entityId: expense.id,
    action: AUDIT_ACTIONS.EXPENSE_CREATED,
    after: { category: expense.category, amount: expense.amount, description: expense.description },
  }).catch(() => {});

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

  if (effectiveFundId) {
    const fund = await prisma.pettyCashFund.findFirst({
      where: { id: effectiveFundId, tenantId },
      select: { paymentAccountId: true },
    });
    if (!fund) throw new Error('Petty cash fund not found');
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
      include: { pettyCashFund: { select: { id: true } } },
    });
    if (!account) throw new Error('Payment account not found');
    if (account.pettyCashFund) effectiveFundId = account.pettyCashFund.id;
  }

  const newFundId = effectiveFundId;
  const newAccountId = effectiveAccountId;
  const newAmount = data.amount !== undefined ? data.amount : oldAmount;
  const sameFund = oldFundId !== null && newFundId === oldFundId;

  // M19-01 (D2): an edit that increases or re-links a fund-backed spend is
  // guarded exactly like a create. When the fund is unchanged the old amount is
  // credited back for the check (`credit`), because the net deduction is what
  // the fund must be able to absorb.
  if (newFundId && (newFundId !== oldFundId || newAmount !== oldAmount)) {
    await assertFundCanSpend(
      tenantId,
      newFundId,
      newAmount,
      data.overdrawApproved === true,
      sameFund ? oldAmount : 0,
    );
    if (data.overdrawApproved === true) {
      void createAuditLog({
        tenantId,
        actorId: data.actorId ?? existing.recordedById,
        actorRole: 'USER',
        entityType: 'PettyCashFund',
        entityId: newFundId,
        action: 'PETTY_CASH_OVERDRAW_APPROVED',
        after: { expenseId: id, amount: newAmount },
      }).catch(() => {});
    }
  }

  const newExpenseDate =
    data.expenseDate !== undefined ? new Date(data.expenseDate) : existing.expenseDate;
  const accountChanged = newAccountId !== oldAccountId;
  const amountChanged = data.amount !== undefined && data.amount !== oldAmount;
  const dateChanged =
    data.expenseDate !== undefined &&
    newExpenseDate.getTime() !== existing.expenseDate.getTime();

  const expense = await prisma.$transaction(async (tx) => {
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
    // account/amount/date reverses the old EXPENSE entries and posts the new
    // amount, all in the same transaction as the expense row.
    if (accountChanged || amountChanged || dateChanged) {
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
              description: `${updated.category} — ${updated.description}`.slice(0, 200),
              credit: newAmount,
              entryDate: newExpenseDate,
            },
          ],
          { allowPettyCashAccount: true },
        );
      }
    }

    return updated;
  });

  // Keep the fund balance in sync with a single net delta when the fund is
  // unchanged, or a refund+deduct pair when the expense moved between funds.
  if (oldFundId && newFundId && oldFundId === newFundId) {
    const delta = oldAmount - newAmount;
    if (delta !== 0) await adjustFundBalance(tenantId, oldFundId, delta);
  } else {
    if (oldFundId) await adjustFundBalance(tenantId, oldFundId, oldAmount);
    if (newFundId) await adjustFundBalance(tenantId, newFundId, -newAmount);
  }

  return expense;
}

export async function deleteExpense(tenantId: string, id: string, actorId: string) {
  const expense = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!expense) {
    throw new Error('Expense not found');
  }

  await prisma.$transaction(async (tx) => {
    await reverseExpenseLedger(
      tx,
      tenantId,
      actorId,
      expense.id,
      expense.description,
    );
    await tx.expense.delete({ where: { id } });
  });

  // Restore the fund balance when a linked petty-cash expense is removed.
  if (expense.pettyCashFundId) {
    await adjustFundBalance(tenantId, expense.pettyCashFundId, expense.amount.toNumber());
  }

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'Expense',
    entityId: id,
    action: AUDIT_ACTIONS.EXPENSE_DELETED,
    before: { category: expense.category, amount: expense.amount, description: expense.description },
  }).catch(() => {});
}
