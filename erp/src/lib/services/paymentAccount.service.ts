import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import {
  PaymentAccountStatus,
  PaymentAccountType,
  PaymentEntrySource,
} from '@/generated/prisma/client';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { TxClient } from '@/lib/services/inventory.service';
import type {
  CloseAccountInput,
  CreatePaymentAccountInput,
  DepositInput,
  FundTransferInput,
  UpdatePaymentAccountInput,
  WithdrawalInput,
} from '@/lib/validators/paymentAccount.validators';

/**
 * Payment accounts — the ledger every money movement passes through.
 *
 * Design notes
 * ------------
 * - `PaymentAccount.balance` is a CACHE. `PaymentAccountEntry` is the truth.
 *   Every mutation posts entries and rewrites the cache inside one
 *   transaction, so a crash can never leave the two disagreeing.
 * - Debit increases, credit decreases (the convention the account book shows
 *   as `Debit | Credit | Balance`).
 * - A transfer produces TWO entries sharing a `transferGroupId`; a settlement
 *   across several accounts shares one too, so an accountant can read the
 *   whole movement back as a unit.
 * - Accounts are never deleted while they hold history — they are CLOSED, and
 *   their remaining balance is swept to a destination account first.
 */

type Tx = TxClient | PrismaClient | Prisma.TransactionClient;

interface LedgerLine {
  accountId: string;
  source: PaymentEntrySource;
  description: string;
  /** Money INTO the account. Mutually exclusive with `credit`. */
  debit?: Decimal | number | string;
  /** Money OUT of the account. Mutually exclusive with `debit`. */
  credit?: Decimal | number | string;
  sourceId?: string | undefined;
  transferGroupId?: string | undefined;
  entryDate?: Date | undefined;
}

function dec(value: Decimal | number | string | undefined): Decimal {
  if (value === undefined) return new Decimal(0);
  return new Decimal(value);
}

function toMoney(value: Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

function makeGroupId(): string {
  return `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// ── Ledger primitives ────────────────────────────────────────────────────────

/**
 * Append ledger lines and rewrite each affected account's cached balance.
 *
 * MUST be called inside a transaction — the caller owns atomicity, because the
 * business operation that caused the movement (a sale, a PO payment) has to
 * commit or roll back with the money.
 */
export async function postLedgerEntries(
  tx: Tx,
  tenantId: string,
  createdById: string,
  lines: LedgerLine[],
): Promise<void> {
  if (lines.length === 0) return;

  const accountIds = Array.from(new Set(lines.map((line) => line.accountId)));

  const accounts = await tx.paymentAccount.findMany({
    where: { id: { in: accountIds }, tenantId },
    select: { id: true, status: true, balance: true, name: true },
  });

  if (accounts.length !== accountIds.length) {
    throw new ApiError(404, 'NOT_FOUND', 'One or more payment accounts were not found');
  }

  const closed = accounts.filter((account) => account.status !== PaymentAccountStatus.ACTIVE);
  if (closed.length > 0) {
    throw new ApiError(409, 'CONFLICT',
      `Account "${closed[0]!.name}" is closed and cannot take new entries`,
    );
  }

  // Running balance per account, seeded from the cached value.
  const running = new Map<string, Decimal>(
    accounts.map((account) => [account.id, new Decimal(account.balance)]),
  );

  const rows: Prisma.PaymentAccountEntryCreateManyInput[] = lines.map((line) => {
    const debit = toMoney(dec(line.debit));
    const credit = toMoney(dec(line.credit));

    if (debit > 0 && credit > 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'A ledger line cannot be both debit and credit');
    }
    if (debit === 0 && credit === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'A ledger line must move a non-zero amount');
    }

    const current = running.get(line.accountId)!;
    const next = current.plus(debit).minus(credit);
    running.set(line.accountId, next);

    return {
      tenantId,
      accountId: line.accountId,
      source: line.source,
      sourceId: line.sourceId ?? null,
      transferGroupId: line.transferGroupId ?? null,
      description: line.description,
      debit,
      credit,
      balanceAfter: toMoney(next),
      entryDate: line.entryDate ?? new Date(),
      createdById,
    };
  });

  await tx.paymentAccountEntry.createMany({ data: rows });

  for (const [accountId, balance] of running) {
    await tx.paymentAccount.update({
      where: { id: accountId },
      data: { balance: toMoney(balance) },
    });
  }
}

/**
 * Post a movement that needs a non-negative source balance.
 *
 * Used for anything that spends real money (expenses, PO settlement,
 * withdrawals). Deposits and sales into an account skip this — they only add.
 */
export async function assertSufficientFunds(
  tx: Tx,
  tenantId: string,
  accountId: string,
  amount: Decimal | number | string,
  overdrawApproved = false,
): Promise<void> {
  if (overdrawApproved) return;

  const account = await tx.paymentAccount.findFirst({
    where: { id: accountId, tenantId },
    select: { name: true, balance: true },
  });

  if (!account) {
    throw new ApiError(404, 'NOT_FOUND', 'Payment account not found');
  }

  const requested = dec(amount);
  if (new Decimal(account.balance).lessThan(requested)) {
    throw new ApiError(422, 'VALIDATION_ERROR',
      `Insufficient funds in "${account.name}": available ${new Decimal(account.balance)
        .toDecimalPlaces(2)
        .toString()}, requested ${requested.toDecimalPlaces(2).toString()}`,
    );
  }
}

// ── Account CRUD ─────────────────────────────────────────────────────────────

export async function listPaymentAccounts(
  tenantId: string,
  filters: {
    status?: PaymentAccountStatus | undefined;
    type?: PaymentAccountType | undefined;
    search?: string | undefined;
  } = {},
) {
  const where: Prisma.PaymentAccountWhereInput = { tenantId };

  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { accountNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const accounts = await prisma.paymentAccount.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });

  const totalBalance = accounts
    .filter((account) => account.status === PaymentAccountStatus.ACTIVE)
    .reduce((sum, account) => sum.plus(account.balance), new Decimal(0));

  return {
    accounts,
    totalBalance: toMoney(totalBalance),
  };
}

export async function getPaymentAccount(tenantId: string, accountId: string) {
  const account = await prisma.paymentAccount.findFirst({
    where: { id: accountId, tenantId },
  });

  if (!account) {
    throw new ApiError(404, 'NOT_FOUND', 'Payment account not found');
  }

  return account;
}

export async function createPaymentAccount(
  tenantId: string,
  actorId: string,
  actorRole: string,
  input: CreatePaymentAccountInput,
) {
  const existing = await prisma.paymentAccount.findFirst({
    where: { tenantId, name: input.name },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, 'CONFLICT', `An account named "${input.name}" already exists`);
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.paymentAccount.create({
      data: {
        tenantId,
        name: input.name,
        type: input.type,
        createdById: actorId,
        ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.details !== undefined ? { details: input.details as Prisma.InputJsonValue } : {}),
      },
    });

    // Opening balance is a real ledger entry, not a magic starting number, so
    // the account book reconciles against the balance shown in the list.
    if (input.openingBalance > 0) {
      await postLedgerEntries(tx, tenantId, actorId, [
        {
          accountId: account.id,
          source: PaymentEntrySource.OPENING_BALANCE,
          description: 'Opening Balance',
          debit: input.openingBalance,
        },
      ]);
    }

    await createAuditLog({
      tenantId,
      actorId,
      actorRole,
      entityType: 'PaymentAccount',
      entityId: account.id,
      action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_CREATED,
      after: {
        name: account.name,
        type: account.type,
        openingBalance: input.openingBalance,
      },
    });

    // Read through `tx`: the global client cannot see rows this transaction has
    // not committed yet, which would 404 on a successful create.
    const created = await tx.paymentAccount.findFirst({ where: { id: account.id, tenantId } });
    if (!created) {
      throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Account was created but could not be read back');
    }
    return created;
  });
}

export async function updatePaymentAccount(
  tenantId: string,
  actorId: string,
  actorRole: string,
  accountId: string,
  input: UpdatePaymentAccountInput,
) {
  const before = await getPaymentAccount(tenantId, accountId);

  if (input.name && input.name !== before.name) {
    const clash = await prisma.paymentAccount.findFirst({
      where: { tenantId, name: input.name, id: { not: accountId } },
      select: { id: true },
    });
    if (clash) {
      throw new ApiError(409, 'CONFLICT', `An account named "${input.name}" already exists`);
    }
  }

  const updated = await prisma.paymentAccount.update({
    where: { id: accountId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.details !== undefined ? { details: input.details as Prisma.InputJsonValue } : {}),
    },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole,
    entityType: 'PaymentAccount',
    entityId: accountId,
    action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_UPDATED,
    before: { name: before.name, type: before.type, note: before.note },
    after: { name: updated.name, type: updated.type, note: updated.note },
  });

  return updated;
}

// ── Money movements ──────────────────────────────────────────────────────────

export async function transferFunds(
  tenantId: string,
  actorId: string,
  actorRole: string,
  input: FundTransferInput,
) {
  const groupId = makeGroupId();
  const amount = dec(input.amount);

  return prisma.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.paymentAccount.findFirst({ where: { id: input.fromAccountId, tenantId } }),
      tx.paymentAccount.findFirst({ where: { id: input.toAccountId, tenantId } }),
    ]);

    if (!from) throw new ApiError(404, 'NOT_FOUND', 'Source account not found');
    if (!to) throw new ApiError(404, 'NOT_FOUND', 'Destination account not found');

    await assertSufficientFunds(tx, tenantId, from.id, amount);

    const note = input.note?.trim();
    const description = note ? `Transfer to ${to.name} — ${note}` : `Transfer to ${to.name}`;
    const inbound = note ? `Transfer from ${from.name} — ${note}` : `Transfer from ${from.name}`;

    await postLedgerEntries(tx, tenantId, actorId, [
      {
        accountId: from.id,
        source: PaymentEntrySource.FUND_TRANSFER,
        sourceId: groupId,
        transferGroupId: groupId,
        description,
        credit: amount,
        ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
      },
      {
        accountId: to.id,
        source: PaymentEntrySource.FUND_TRANSFER,
        sourceId: groupId,
        transferGroupId: groupId,
        description: inbound,
        debit: amount,
        ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
      },
    ]);

    await createAuditLog({
      tenantId,
      actorId,
      actorRole,
      entityType: 'PaymentAccountTransfer',
      entityId: groupId,
      action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_TRANSFER,
      after: {
        from: from.name,
        to: to.name,
        amount: toMoney(amount),
        note: note ?? null,
      },
    });

    return { transferGroupId: groupId, amount: toMoney(amount) };
  });
}

/**
 * Money entering an account from outside the tracked accounts (owner's cash,
 * a bank interest credit, cash found in the drawer).
 *
 * The reference system models this as `Deposit` with an optional
 * "Deposit From" — when a source account IS supplied we record both legs so
 * the source's balance drops too.
 */
export async function depositFunds(
  tenantId: string,
  actorId: string,
  actorRole: string,
  accountId: string,
  input: DepositInput,
) {
  const groupId = makeGroupId();
  const amount = dec(input.amount);

  return prisma.$transaction(async (tx) => {
    const target = await tx.paymentAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Payment account not found');

    const lines: LedgerLine[] = [];
    const note = input.note?.trim();

    if (input.fromAccountId) {
      const source = await tx.paymentAccount.findFirst({
        where: { id: input.fromAccountId, tenantId },
      });
      if (!source) throw new ApiError(404, 'NOT_FOUND', 'Source account not found');
      if (source.id === target.id) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Source and destination accounts must differ');
      }
      await assertSufficientFunds(tx, tenantId, source.id, amount);

      lines.push({
        accountId: source.id,
        source: PaymentEntrySource.DEPOSIT,
        sourceId: groupId,
        transferGroupId: groupId,
        description: note ? `Deposit to ${target.name} — ${note}` : `Deposit to ${target.name}`,
        credit: amount,
        ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
      });
    }

    lines.push({
      accountId: target.id,
      source: PaymentEntrySource.DEPOSIT,
      sourceId: groupId,
      transferGroupId: groupId,
      description: note ? `Deposit — ${note}` : 'Deposit',
      debit: amount,
      ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
    });

    await postLedgerEntries(tx, tenantId, actorId, lines);

    await createAuditLog({
      tenantId,
      actorId,
      actorRole,
      entityType: 'PaymentAccountDeposit',
      entityId: groupId,
      action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_DEPOSIT,
      after: {
        account: target.name,
        from: input.fromAccountId ?? null,
        amount: toMoney(amount),
        note: note ?? null,
      },
    });

    return { transferGroupId: groupId, amount: toMoney(amount) };
  });
}

export async function withdrawFunds(
  tenantId: string,
  actorId: string,
  actorRole: string,
  accountId: string,
  input: WithdrawalInput,
) {
  const groupId = makeGroupId();
  const amount = dec(input.amount);

  return prisma.$transaction(async (tx) => {
    const source = await tx.paymentAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!source) throw new ApiError(404, 'NOT_FOUND', 'Payment account not found');

    await assertSufficientFunds(tx, tenantId, source.id, amount);

    const note = input.note?.trim();
    const lines: LedgerLine[] = [
      {
        accountId: source.id,
        source: PaymentEntrySource.WITHDRAWAL,
        sourceId: groupId,
        transferGroupId: groupId,
        description: note ? `Withdrawal — ${note}` : 'Withdrawal',
        credit: amount,
        ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
      },
    ];

    if (input.toAccountId) {
      const target = await tx.paymentAccount.findFirst({
        where: { id: input.toAccountId, tenantId },
      });
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Destination account not found');
      if (target.id === source.id) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Source and destination accounts must differ');
      }
      lines.push({
        accountId: target.id,
        source: PaymentEntrySource.WITHDRAWAL,
        sourceId: groupId,
        transferGroupId: groupId,
        description: note ? `Withdrawal from ${source.name} — ${note}` : `Withdrawal from ${source.name}`,
        debit: amount,
        ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
      });
    }

    await postLedgerEntries(tx, tenantId, actorId, lines);

    await createAuditLog({
      tenantId,
      actorId,
      actorRole,
      entityType: 'PaymentAccountWithdrawal',
      entityId: groupId,
      action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_WITHDRAWAL,
      after: { account: source.name, amount: toMoney(amount), note: note ?? null },
    });

    return { transferGroupId: groupId, amount: toMoney(amount) };
  });
}

/**
 * Retire an account. Its remaining balance must be swept somewhere first, so
 * closing can never silently make money disappear from the books.
 */
export async function closePaymentAccount(
  tenantId: string,
  actorId: string,
  actorRole: string,
  accountId: string,
  input: CloseAccountInput,
) {
  const groupId = makeGroupId();

  return prisma.$transaction(async (tx) => {
    const account = await tx.paymentAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new ApiError(404, 'NOT_FOUND', 'Payment account not found');
    if (account.status === PaymentAccountStatus.CLOSED) {
      throw new ApiError(409, 'CONFLICT', 'Account is already closed');
    }

    const balance = new Decimal(account.balance);

    if (balance.greaterThan(0)) {
      if (!input.transferToAccountId) {
        throw new ApiError(422, 'VALIDATION_ERROR',
          'Select an account to receive the remaining balance before closing',
        );
      }

      const target = await tx.paymentAccount.findFirst({
        where: { id: input.transferToAccountId, tenantId },
      });
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Destination account not found');
      if (target.id === account.id) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Choose a different destination account');
      }

      await postLedgerEntries(tx, tenantId, actorId, [
        {
          accountId: account.id,
          source: PaymentEntrySource.CLOSING_TRANSFER,
          sourceId: groupId,
          transferGroupId: groupId,
          description: `Closing transfer to ${target.name}`,
          credit: balance,
        },
        {
          accountId: target.id,
          source: PaymentEntrySource.CLOSING_TRANSFER,
          sourceId: groupId,
          transferGroupId: groupId,
          description: `Closing transfer from ${account.name}`,
          debit: balance,
        },
      ]);
    }

    const closed = await tx.paymentAccount.update({
      where: { id: account.id },
      data: {
        status: PaymentAccountStatus.CLOSED,
        closedAt: new Date(),
        closedById: actorId,
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });

    await createAuditLog({
      tenantId,
      actorId,
      actorRole,
      entityType: 'PaymentAccount',
      entityId: account.id,
      action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_CLOSED,
      before: { status: account.status, balance: account.balance.toString() },
      after: { status: closed.status, sweptTo: input.transferToAccountId ?? null },
    });

    return closed;
  });
}

// ── Account book ─────────────────────────────────────────────────────────────

export async function getAccountBook(
  tenantId: string,
  accountId: string,
  query: {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    source?: PaymentEntrySource | undefined;
    page: number;
    pageSize: number;
  },
) {
  const account = await getPaymentAccount(tenantId, accountId);

  const where: Prisma.PaymentAccountEntryWhereInput = { tenantId, accountId };

  if (query.dateFrom || query.dateTo) {
    where.entryDate = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
    };
  }
  if (query.source) where.source = query.source;

  const [entries, total] = await Promise.all([
    prisma.paymentAccountEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.paymentAccountEntry.count({ where }),
  ]);

  const totals = await prisma.paymentAccountEntry.aggregate({
    where,
    _sum: { debit: true, credit: true },
  });

  return {
    account,
    entries,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
    sums: {
      debit: toMoney(dec(totals._sum.debit ?? 0)),
      credit: toMoney(dec(totals._sum.credit ?? 0)),
    },
  };
}

/** Tenant-wide cash-flow view: every account's entries for a window. */
export async function getCashFlow(
  tenantId: string,
  query: {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    accountId?: string | undefined;
    page: number;
    pageSize: number;
  },
) {
  const where: Prisma.PaymentAccountEntryWhereInput = { tenantId };

  if (query.accountId) where.accountId = query.accountId;
  if (query.dateFrom || query.dateTo) {
    where.entryDate = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  const [entries, total] = await Promise.all([
    prisma.paymentAccountEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { account: { select: { id: true, name: true, type: true } } },
    }),
    prisma.paymentAccountEntry.count({ where }),
  ]);

  const totals = await prisma.paymentAccountEntry.aggregate({
    where,
    _sum: { debit: true, credit: true },
  });

  return {
    entries,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
    sums: {
      debit: toMoney(dec(totals._sum.debit ?? 0)),
      credit: toMoney(dec(totals._sum.credit ?? 0)),
    },
  };
}

export const PAYMENT_ACCOUNT_TYPES = Object.values(PaymentAccountType);
export const PAYMENT_ENTRY_SOURCES = Object.values(PaymentEntrySource);
