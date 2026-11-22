import Decimal from 'decimal.js';

import { PaymentEntrySource } from '@/generated/prisma/client';
import type { PaymentLegMethod, ReturnRefundMethod } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { postLedgerEntries } from '@/lib/services/paymentAccount.service';
import type { TxClient } from '@/lib/services/inventory.service';

/**
 * Route sale money into payment accounts.
 *
 * Every completed sale must land in an account, mirroring how the business
 * actually holds the money:
 *
 *   CASH          → the Cash account
 *   CARD          → the card/bank acquirer account
 *   LANKAQR       → the QR/gateway account
 *   SPLIT         → cash portion to Cash, digital portion to the digital account
 *   NONE (zero)   → nothing to collect, no entries
 *
 * The account for each method is resolved per tenant from the settings stored
 * on the account itself rather than hard-coded ids, so a tenant that renames or
 * adds accounts keeps working. Resolution order:
 *
 *   1. `preferredAccountId` passed by the caller (operator picked one)
 *   2. the tenant's default account for that method, if flagged
 *   3. the first ACTIVE account matching the method's expected type
 *
 * When a tenant has not created any account yet, sales still complete — the
 * ledger entry is skipped and the sale is unaffected. Accounting must never be
 * the reason a customer cannot pay.
 */

/** Which account type each tender method should look for. */
const METHOD_ACCOUNT_TYPE = {
  CASH: 'CASH',
  CARD: 'CREDIT_CARD',
  LANKAQR: 'PAYMENT_GATEWAY',
} as const;

type TenderMethod = keyof typeof METHOD_ACCOUNT_TYPE;

export interface SaleAccountLeg {
  method: TenderMethod;
  amount: Decimal | number | string;
}

interface ResolveOptions {
  tenantId: string;
  method: TenderMethod;
  preferredAccountId?: string | undefined;
}

/**
 * Find the account a tender method should settle into, or `null` when the
 * tenant has no eligible account.
 */
export async function resolveSaleAccountId({
  tenantId,
  method,
  preferredAccountId,
}: ResolveOptions): Promise<string | null> {
  // Petty-cash accounts are intentionally excluded from sale routing. Their
  // balance is owned by the petty-cash fund, so a sale landing there would
  // either be rejected by the ledger guard (the bug this fixes) or desync the
  // fund. Sales must settle into a normal account; if the tenant has none the
  // ledger entry is skipped, and the sale still completes.
  const saleable = { tenantId, status: 'ACTIVE', pettyCashFund: null } as const;

  if (preferredAccountId) {
    const preferred = await prisma.paymentAccount.findFirst({
      where: { ...saleable, id: preferredAccountId },
      select: { id: true },
    });
    if (preferred) return preferred.id;
  }

  const byType = await prisma.paymentAccount.findFirst({
    where: { ...saleable, type: METHOD_ACCOUNT_TYPE[method] },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (byType) return byType.id;

  // A tenant may only have a BANK account (no CASH/CREDIT_CARD typed one).
  // Fall back to the first active account so money is still tracked rather
  // than silently unaccounted for.
  const anyActive = await prisma.paymentAccount.findFirst({
    where: saleable,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return anyActive?.id ?? null;
}

/**
 * Post the ledger entries for a completed sale.
 *
 * Must be called inside the sale's transaction so the money and the sale commit
 * together. Returns the number of entries written.
 */
export async function postSaleToAccounts(
  tx: TxClient,
  tenantId: string,
  actorId: string,
  saleId: string,
  saleReference: string,
  legs: SaleAccountLeg[],
  preferredAccountIds: Partial<Record<TenderMethod, string | undefined>> = {},
): Promise<number> {
  const lines: Array<{
    accountId: string;
    source: PaymentEntrySource;
    sourceId: string;
    description: string;
    debit: number;
  }> = [];

  const resolved = new Map<TenderMethod, string | null>();

  for (const leg of legs) {
    const amount = new Decimal(leg.amount);
    if (amount.lessThanOrEqualTo(0)) continue;

    let accountId = resolved.get(leg.method) ?? null;
    if (!resolved.has(leg.method)) {
      accountId = await resolveSaleAccountId({
        tenantId,
        method: leg.method,
        preferredAccountId: preferredAccountIds[leg.method],
      });
      resolved.set(leg.method, accountId);
    }

    // No eligible account: leave the sale untouched rather than failing it.
    if (!accountId) continue;

    lines.push({
      accountId,
      source: PaymentEntrySource.SALE,
      sourceId: saleId,
      description: `Sale ${saleReference} (${leg.method})`,
      debit: amount.toDecimalPlaces(2).toNumber(),
    });
  }

  if (lines.length === 0) return 0;

  await postLedgerEntries(tx, tenantId, actorId, lines);
  return lines.length;
}

/**
 * Reverse a sale's ledger impact (void / full refund).
 *
 * Credits each account the sale originally debited, using the same
 * `sourceId = saleId` linkage so the reversal pairs with the original entries.
 */
export async function reverseSaleAccounts(
  tx: TxClient,
  tenantId: string,
  actorId: string,
  saleId: string,
  saleReference: string,
): Promise<number> {
  const original = await tx.paymentAccountEntry.findMany({
    where: {
      tenantId,
      source: PaymentEntrySource.SALE,
      sourceId: saleId,
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const reversals = original
    .map((entry) => {
      const net = new Decimal(entry.debit).minus(entry.credit);
      if (net.equals(0)) return null;
      return {
        accountId: entry.accountId,
        source: PaymentEntrySource.SALE_REFUND,
        sourceId: saleId,
        description: `Reversal of sale ${saleReference}`,
        // Original debited → now credit, and vice versa.
        ...(net.greaterThan(0)
          ? { credit: net.toDecimalPlaces(2).toNumber() }
          : { debit: net.abs().toDecimalPlaces(2).toNumber() }),
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (reversals.length === 0) return 0;

  await postLedgerEntries(tx, tenantId, actorId, reversals);
  return reversals.length;
}

/**
 * Split a sale's payment legs into the account legs to post.
 *
 * Kept separate from `postSaleToAccounts` so the mapping is unit-testable
 * without a database.
 */
export function buildSaleAccountLegs(input: {
  paymentMethod: 'CASH' | 'CARD' | 'LANKAQR' | 'SPLIT' | 'NONE' | 'STORE_CREDIT' | 'EXCHANGE_CREDIT';
  totalAmount: Decimal | number | string;
  cardAmount?: Decimal | number | string | undefined;
  splitLegMethod?: 'CARD' | 'LANKAQR' | undefined;
}): SaleAccountLeg[] {
  const total = new Decimal(input.totalAmount);
  // NONE (zero-value), STORE_CREDIT and EXCHANGE_CREDIT collect no money into
  // an account: they settle against a customer balance / a linked return.
  if (
    total.lessThanOrEqualTo(0) ||
    input.paymentMethod === 'NONE' ||
    input.paymentMethod === 'STORE_CREDIT' ||
    input.paymentMethod === 'EXCHANGE_CREDIT'
  ) {
    return [];
  }

  switch (input.paymentMethod) {
    case 'CASH':
      return [{ method: 'CASH', amount: total }];
    case 'CARD':
      return [{ method: 'CARD', amount: total }];
    case 'LANKAQR':
      return [{ method: 'LANKAQR', amount: total }];
    case 'SPLIT': {
      const digital = new Decimal(input.cardAmount ?? 0);
      const cash = total.minus(digital);
      const legs: SaleAccountLeg[] = [];
      if (digital.greaterThan(0)) {
        legs.push({ method: input.splitLegMethod ?? 'CARD', amount: digital });
      }
      if (cash.greaterThan(0)) legs.push({ method: 'CASH', amount: cash });
      return legs;
    }
    default:
      return [];
  }
}

// ── Return refunds ───────────────────────────────────────────────────────────

/**
 * ARGUS #97 — which account leg a refund should credit.
 *
 * Sale money is debited into the account for its tender; a refund moves it the
 * other way, so the leg is credited. Cash refunds credit Cash; a card reversal
 * credits the card/gateway account that took the original digital tender.
 * Store credit and exchange move no account money (a customer balance / the
 * replacement sale settles them).
 */
export function buildReturnAccountLegs(input: {
  refundMethod: ReturnRefundMethod;
  refundAmount: Decimal | number | string;
  /** Tenders collected on the original sale (`Payment` legs). */
  originalTenders: Iterable<PaymentLegMethod>;
}): SaleAccountLeg[] {
  const amount = new Decimal(input.refundAmount);
  if (amount.lessThanOrEqualTo(0)) return [];

  if (input.refundMethod === 'STORE_CREDIT' || input.refundMethod === 'EXCHANGE') {
    return [];
  }

  const tenders = new Set(input.originalTenders);

  if (input.refundMethod === 'CASH') {
    // Guarded by ARGUS #96 in the service; returning [] here keeps the ledger
    // truthful for historical records that bypassed the rule.
    return tenders.has('CASH') ? [{ method: 'CASH', amount }] : [];
  }

  // CARD_REVERSAL — return through the digital account the sale actually used.
  const digitalTender: TenderMethod | null = tenders.has('CARD')
    ? 'CARD'
    : tenders.has('LANKAQR')
      ? 'LANKAQR'
      : null;

  return digitalTender ? [{ method: digitalTender, amount }] : [];
}

/**
 * Post the refund leg for a completed return.
 *
 * Must be called inside the return's transaction so the return row and the
 * money movement commit together. When the tenant has no eligible account the
 * entry is skipped, mirroring sales — accounting must never block a refund.
 */
export async function postReturnRefundToAccounts(
  tx: TxClient,
  tenantId: string,
  actorId: string,
  returnId: string,
  returnReference: string,
  legs: SaleAccountLeg[],
): Promise<number> {
  const lines: Array<{
    accountId: string;
    source: PaymentEntrySource;
    sourceId: string;
    description: string;
    credit: number;
  }> = [];

  const resolved = new Map<TenderMethod, string | null>();

  for (const leg of legs) {
    const amount = new Decimal(leg.amount);
    if (amount.lessThanOrEqualTo(0)) continue;

    let accountId = resolved.get(leg.method) ?? null;
    if (!resolved.has(leg.method)) {
      accountId = await resolveSaleAccountId({ tenantId, method: leg.method });
      resolved.set(leg.method, accountId);
    }

    if (!accountId) continue;

    lines.push({
      accountId,
      source: PaymentEntrySource.SALE_REFUND,
      sourceId: returnId,
      description: `Refund ${returnReference} (${leg.method})`,
      credit: amount.toDecimalPlaces(2).toNumber(),
    });
  }

  if (lines.length === 0) return 0;

  await postLedgerEntries(tx, tenantId, actorId, lines);
  return lines.length;
}
