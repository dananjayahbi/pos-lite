/* eslint-disable no-console -- operator audit/repair CLI: prints every finding */
/**
 * Petty-cash ledger + top-up reconciliation audit/repair (ARGUS #406).
 *
 * READ-ONLY by default. It walks each fund's payment-account ledger in
 * date/id order and reports:
 *   - balanceAfter breaks (expected = previous actual + debit − credit);
 *   - PETTY_CASH_TOP_UP audits with no matching debit on the fund account;
 *   - top-up ledger debits with no matching audit;
 *   - the fund equation vs the account's carried balance.
 *
 * With --apply it appends a correcting DEPOSIT for each missing top-up (and
 * recomputes the fund balance). With --rebuild-balance-after it rewrites the
 * historical balanceAfter column in one transaction, recording an audit row.
 * Amounts/debits/credits are never changed.
 *
 *   node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts
 *   node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts --apply
 *   node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts --apply --rebuild-balance-after
 *   node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts --tenant=<id>
 */
import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { PaymentEntrySource } from '../src/generated/prisma/client';
import {
  auditLedgerTrail,
  matchTopUpAudits,
  planBalanceAfterRebuild,
  type LedgerTrailRow,
  type TopUpAuditRow,
  type TopUpLedgerRow,
} from '@/lib/services/pettyCashReconciliation.core';

const APPLY = process.argv.includes('--apply');
const REBUILD = process.argv.includes('--rebuild-balance-after');
const TENANT_ID = process.argv
  .find((arg) => arg.startsWith('--tenant='))
  ?.slice('--tenant='.length);

const TOP_UP_SOURCES = [
  PaymentEntrySource.DEPOSIT,
  PaymentEntrySource.FUND_TRANSFER,
  PaymentEntrySource.CLOSING_TRANSFER,
] as const;

const TOP_UP_AUDIT_ACTION = 'PETTY_CASH_TOP_UP';
const CORRECTION_SOURCE_PREFIX = 'pc_correction_';

interface ParsedTopUpAudit extends TopUpAuditRow {
  description: string | null;
  sourceAccountId: string | null;
}

function money(value: unknown): string {
  const raw =
    typeof value === 'number' || typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String(value)
        : 0;
  return new Decimal(raw).toFixed(2);
}

function parseAfter(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function main() {
  const funds = await prisma.pettyCashFund.findMany({
    where: { isActive: true, ...(TENANT_ID ? { tenantId: TENANT_ID } : {}) },
    orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }],
  });

  if (funds.length === 0) {
    console.log('No active petty-cash funds found. Nothing to audit.');
    return;
  }

  let fundsWithFindings = 0;
  let appliedTopUps = 0;
  let rebuiltRows = 0;

  for (const fund of funds) {
    const tenantId = fund.tenantId;
    const accountId = fund.paymentAccountId;

    console.log(`\n=== ${fund.name} (${fund.id}) tenant=${tenantId}`);
    console.log(
      `fund.currentBalance=${money(fund.currentBalance)} opening=${money(fund.openingBalance)}`,
    );

    if (!accountId) {
      console.log('  payment account: not linked (cannot audit the ledger)');
      continue;
    }

    const [account, ledger, auditRows] = await Promise.all([
      prisma.paymentAccount.findFirst({
        where: { id: accountId, tenantId },
        select: { id: true, name: true, balance: true },
      }),
      prisma.paymentAccountEntry.findMany({
        where: { tenantId, accountId },
        orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.auditLog.findMany({
        where: {
          tenantId,
          entityType: 'PettyCashFund',
          entityId: fund.id,
          action: TOP_UP_AUDIT_ACTION,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!account) {
      console.log('  payment account row missing');
      continue;
    }

    const trailRows: LedgerTrailRow[] = ledger.map((entry) => ({
      id: entry.id,
      entryDate: entry.entryDate,
      createdAt: entry.createdAt,
      debit: entry.debit.toString(),
      credit: entry.credit.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      source: entry.source,
      description: entry.description,
    }));
    const trail = auditLedgerTrail(trailRows);

    const audits: ParsedTopUpAudit[] = auditRows.map((row) => {
      const after = parseAfter(row.after);
      return {
        id: row.id,
        createdAt: row.createdAt,
        entryDate: typeof after.entryDate === 'string' ? after.entryDate : null,
        amount: after.amount as string | number | null | undefined,
        description: typeof after.description === 'string' ? after.description : null,
        sourceAccountId:
          typeof after.sourceAccountId === 'string' ? after.sourceAccountId : null,
        ledgerEntryIds: Array.isArray(after.ledgerEntryIds)
          ? after.ledgerEntryIds.filter((id): id is string => typeof id === 'string')
          : null,
      };
    });

    const topUpEntries: TopUpLedgerRow[] = ledger
      .filter(
        (entry) =>
          entry.debit.greaterThan(0) &&
          (TOP_UP_SOURCES as readonly string[]).includes(entry.source),
      )
      .map((entry) => ({
        id: entry.id,
        entryDate: entry.entryDate,
        amount: entry.debit.toString(),
        description: entry.description,
      }));

    const matches = matchTopUpAudits(audits, topUpEntries);
    const actor = await prisma.user.findFirst({
      where: { tenantId, role: 'OWNER', isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const actorId = actor?.id ?? null;

    console.log(
      `  ledger: ${ledger.length} entries, final balanceAfter=${trail.finalBalanceAfter}, ` +
        `account.balance=${money(account.balance)}`,
    );
    console.log(`  balanceAfter breaks: ${trail.breaks.length}`);
    for (const brk of trail.breaks) {
      console.log(
        `    ${brk.id} #${brk.index}: expected ${brk.expectedBalanceAfter}, ` +
          `actual ${brk.actualBalanceAfter}, diff ${brk.difference}`,
      );
    }

    console.log(
      `  top-up audits: ${audits.length}, matched=${matches.matched.length}, ` +
        `unmatched audits=${matches.unmatchedAudits.length}, ` +
        `unmatched ledger debits=${matches.unmatchedLedgerEntries.length}`,
    );
    for (const audit of matches.unmatchedAudits) {
      console.log(
        `    MISSING LEDGER: audit ${audit.id} ${money(audit.amount)} on ` +
          `${String(audit.entryDate ?? audit.createdAt).slice(0, 10)} ` +
          `${'description' in audit && audit.description ? `(${String(audit.description)})` : ''}`,
      );
    }
    for (const entry of matches.unmatchedLedgerEntries) {
      console.log(
        `    MISSING AUDIT: ledger ${entry.id} ${money(entry.amount)} on ` +
          `${String(entry.entryDate).slice(0, 10)}`,
      );
    }
    if (matches.unmatchedAudits.length > 0) {
      console.log(
        '    --apply appends the missing top-up debit(s) on the fund account and recomputes ' +
          'PettyCashFund.currentBalance from opening + all top-ups − expenses.',
      );
    }

    const topUpTotal = topUpEntries.reduce(
      (sum, entry) => sum.plus(new Decimal(entry.amount?.toString() ?? '0')),
      new Decimal(0),
    );
    const expenseAgg = await prisma.expense.aggregate({
      where: { tenantId, pettyCashFundId: fund.id },
      _sum: { amount: true },
    });
    const equationBalance = new Decimal(fund.openingBalance.toString())
      .plus(topUpTotal)
      .minus(expenseAgg._sum.amount?.toString() ?? '0')
      .toDecimalPlaces(2);
    console.log(
      `  equation: opening ${money(fund.openingBalance)} + top-ups ${topUpTotal.toFixed(2)} ` +
        `− expenses ${money(expenseAgg._sum.amount)} = ${equationBalance.toFixed(2)} ` +
        `(fund.currentBalance ${money(fund.currentBalance)})`,
    );

    const hasFindings =
      trail.breaks.length > 0 ||
      matches.unmatchedAudits.length > 0 ||
      matches.unmatchedLedgerEntries.length > 0 ||
      !equationBalance.equals(new Decimal(fund.currentBalance.toString()));
    if (hasFindings) fundsWithFindings += 1;

    if (APPLY && matches.unmatchedAudits.length > 0) {
      for (const audit of matches.unmatchedAudits) {
        const amount = new Decimal(audit.amount?.toString() ?? '0');
        if (amount.lessThanOrEqualTo(0)) {
          console.log(`  SKIP audit ${audit.id}: unreadable/non-positive amount`);
          continue;
        }

        const correctionSourceId = `${CORRECTION_SOURCE_PREFIX}${audit.id}`;
        const existingCorrection = await prisma.paymentAccountEntry.findFirst({
          where: { tenantId, accountId, sourceId: correctionSourceId },
          select: { id: true },
        });
        if (existingCorrection) {
          console.log(`  SKIP audit ${audit.id}: correction already present`);
          continue;
        }

        const entryDate =
          audit.entryDate instanceof Date
            ? audit.entryDate
            : new Date(audit.entryDate ?? audit.createdAt);

        const applied = await prisma.$transaction(async (tx) => {
          const currentAccount = await tx.paymentAccount.findFirst({
            where: { id: accountId, tenantId },
            select: { balance: true, status: true, name: true },
          });
          if (!currentAccount) throw new Error('Payment account disappeared');
          if (currentAccount.status !== 'ACTIVE') {
            throw new Error(`Account "${currentAccount.name}" is not active`);
          }

          const balanceAfter = new Decimal(currentAccount.balance.toString())
            .plus(amount)
            .toDecimalPlaces(2);
          const entry = await tx.paymentAccountEntry.create({
            data: {
              tenantId,
              accountId,
              source: PaymentEntrySource.DEPOSIT,
              sourceId: correctionSourceId,
              description: `Correction: missing ledger entry for top-up audit ${audit.id}`.slice(
                0,
                200,
              ),
              debit: amount.toFixed(2),
              credit: '0.00',
              balanceAfter: balanceAfter.toFixed(2),
              entryDate,
              createdById: actorId ?? 'system',
            },
          });

          await tx.paymentAccount.update({
            where: { id: accountId },
            data: { balance: balanceAfter.toFixed(2) },
          });

          await tx.auditLog.create({
            data: {
              tenantId,
              actorId,
              actorRole: 'SYSTEM',
              entityType: 'PettyCashFund',
              entityId: fund.id,
              action: 'PETTY_CASH_TOP_UP_RECONCILED',
              after: {
                auditId: audit.id,
                ledgerEntryId: entry.id,
                amount: amount.toFixed(2),
                entryDate: entryDate.toISOString(),
                sourceAccountId: audit.sourceAccountId ?? null,
                note: 'Appended a missing top-up debit from the reconciliation CLI.',
              },
            },
          });

          // The fund balance is owned separately from the account: recompute it
          // from opening + all ledger top-ups − linked expenses.
          const topUps = await tx.paymentAccountEntry.aggregate({
            where: {
              tenantId,
              accountId,
              source: { in: [...TOP_UP_SOURCES] },
              debit: { gt: 0 },
            },
            _sum: { debit: true },
          });
          const expenses = await tx.expense.aggregate({
            where: { tenantId, pettyCashFundId: fund.id },
            _sum: { amount: true },
          });
          const nextFundBalance = new Decimal(fund.openingBalance.toString())
            .plus(topUps._sum.debit?.toString() ?? '0')
            .minus(expenses._sum.amount?.toString() ?? '0')
            .toDecimalPlaces(2);
          await tx.pettyCashFund.update({
            where: { id: fund.id },
            data: { currentBalance: nextFundBalance.toFixed(2) },
          });

          return { entry, nextFundBalance };
        });

        appliedTopUps += 1;
        console.log(
          `  APPLIED top-up ${money(amount)} for audit ${audit.id} -> ledger ${applied.entry.id}; ` +
            `fund balance now ${applied.nextFundBalance.toFixed(2)}`,
        );
        if (audit.sourceAccountId) {
          console.log(
            `    NOTE: source account ${audit.sourceAccountId} was not touched; verify it separately.`,
          );
        }
      }
    }

    if (APPLY && REBUILD) {
      const freshEntries = await prisma.paymentAccountEntry.findMany({
        where: { tenantId, accountId },
        orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const plan = planBalanceAfterRebuild(
        freshEntries.map((entry) => ({
          id: entry.id,
          entryDate: entry.entryDate,
          createdAt: entry.createdAt,
          debit: entry.debit.toString(),
          credit: entry.credit.toString(),
          balanceAfter: entry.balanceAfter.toString(),
        })),
      );

      if (plan.updates.length === 0) {
        console.log('  balanceAfter trail already consistent; no rebuild needed.');
      } else {
        await prisma.$transaction(async (tx) => {
          for (const update of plan.updates) {
            await tx.paymentAccountEntry.update({
              where: { id: update.id },
              data: { balanceAfter: update.balanceAfter },
            });
          }
          await tx.auditLog.create({
            data: {
              tenantId,
              actorId,
              actorRole: 'SYSTEM',
              entityType: 'PettyCashFund',
              entityId: fund.id,
              action: 'PETTY_CASH_LEDGER_BALANCE_REBUILT',
              before: { updatedRows: plan.updates.length },
              after: {
                accountId,
                updatedRows: plan.updates.length,
                expectedFinalBalanceAfter: plan.expectedFinalBalanceAfter,
                rows: plan.updates.slice(0, 50).map((update) => ({
                  id: update.id,
                  previous: update.previous,
                  balanceAfter: update.balanceAfter,
                })),
                note: 'balanceAfter was not reproducible from the preceding row; only the running-balance column was rewritten. Debits/credits are unchanged.',
              },
            },
          });
        });
        rebuiltRows += plan.updates.length;
        console.log(
          `  REBUILT ${plan.updates.length} balanceAfter row(s); final ${plan.expectedFinalBalanceAfter}`,
        );
      }
    }
  }

  console.log(
    `\n${APPLY ? 'Repair' : 'Audit'} complete: ${funds.length} fund(s), ` +
      `${fundsWithFindings} with findings, ${appliedTopUps} top-up correction(s), ` +
      `${rebuiltRows} balanceAfter row(s) rewritten.`,
  );
  if (!APPLY) {
    console.log('Read-only run. Re-run with --apply to append missing top-ups; add --rebuild-balance-after to repair the running balance.');
  }
}

main()
  .catch((error) => {
    console.error('Petty-cash reconciliation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
