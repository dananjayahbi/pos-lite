import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { setSentryTenantContext } from '@/lib/sentry/context';
import type { ReconciliationFilters } from '@/lib/validators/reconciliation.validators';
import {
  parseRemittanceFile,
  type RemittanceParsedRow,
} from '@/lib/services/reconciliation-parser.service';
import {
  classifyDiscrepancy,
  isDiscrepant,
} from '@/lib/services/reconciliation-discrepancy.service';
import {
  auditDeductionCompliance,
  computeNetPayoutBreakdown,
} from '@/lib/services/reconciliation-finance.service';

/**
 * Reconciliation service — COD settlement ledger + remittance statement import.
 * Trans Express does not return financials via the API, so AyurPOS maintains an
 * expected-receivables ledger and reconciles it against portal CSV/Excel
 * statements.
 */

export async function getLedgerEntries(tenantId: string, filters: ReconciliationFilters) {
  const { status, search, page, limit } = filters;

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (filters.category) where.discrepancyCategory = filters.category;
  if (filters.matchMethod) where.matchMethod = filters.matchMethod;
  if (search) {
    where.OR = [
      { waybillId: { contains: search, mode: 'insensitive' } },
      { delivery: { orderRef: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items, discrepancySummary] = await Promise.all([
    prisma.reconciliationLedgerEntry.count({ where: where as never }),
    prisma.reconciliationLedgerEntry.findMany({
      where: where as never,
      include: {
        delivery: { select: { orderRef: true, status: true, deliveredAt: true } },
        statementImport: { select: { id: true, filename: true, uploadedAt: true } },
        disputes: { select: { id: true, status: true }, orderBy: { openedAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    getDiscrepancySummary(tenantId),
  ]);

  return { items, total, page, limit, discrepancySummary };
}

/** Per-category counts of discrepant ledger entries (for the summary view). */
export async function getDiscrepancySummary(tenantId: string) {
  const grouped = await prisma.reconciliationLedgerEntry.groupBy({
    by: ['discrepancyCategory'],
    where: { tenantId, discrepancyCategory: { not: null } },
    _count: { _all: true },
  });
  const summary: Record<string, number> = {};
  for (const g of grouped) {
    if (g.discrepancyCategory) summary[g.discrepancyCategory] = g._count._all;
  }
  return summary;
}

/** Pending-COD aging summary (delivered but unsettled). */
export async function getPendingCodAging(tenantId: string) {
  const pending = await prisma.reconciliationLedgerEntry.findMany({
    where: { tenantId, status: 'PENDING_SETTLEMENT' },
    include: { delivery: { select: { deliveredAt: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();
  const buckets = { under7: 0, under14: 0, overdue: 0 };
  let totalAmount = 0;
  let count = 0;

  for (const entry of pending) {
    const refDate = entry.delivery?.deliveredAt ?? entry.createdAt;
    const days = Math.floor((now - refDate.getTime()) / (24 * 60 * 60 * 1000));
    if (days < 7) buckets.under7++;
    else if (days < 14) buckets.under14++;
    else buckets.overdue++;
    totalAmount += Number(entry.expectedCod.toString());
    count++;
  }

  return { buckets, count, totalPendingCod: totalAmount };
}

/**
 * Import a remittance statement (CSV or Excel) and match rows to ledger entries.
 * Idempotent: re-uploading the same statement (dedup by batch + waybill) never
 * double-settles. Never auto-clears financial discrepancies.
 *
 * `buffer` may be a UTF-8 CSV string or an Excel workbook buffer; the file type
 * is detected from `filename`.
 */
export async function importRemittanceStatement(
  tenantId: string,
  userId: string,
  filename: string,
  buffer: Buffer | string,
): Promise<unknown> {
  setSentryTenantContext({ tenantId });

  const content = typeof buffer === 'string' ? Buffer.from(buffer, 'utf-8') : buffer;
  const rows = parseRemittanceFile(filename, content);

  const statement = await prisma.statementImport.create({
    data: {
      tenantId,
      filename,
      uploadedById: userId,
      status: 'PARSED',
      rowCount: rows.length,
      rawRows: rows.map((r) => r.raw) as never,
    },
  });

  let matchedCount = 0;
  let discrepancyCount = 0;

  for (const row of rows) {
    const match = await matchStatementRow(tenantId, row, statement.id);
    if (match === 'matched') matchedCount++;
    else if (match === 'discrepancy') discrepancyCount++;
    // 'unmatched' rows are counted in the import totals below as skipped.
  }

  const finalStatement = await prisma.statementImport.update({
    where: { id: statement.id },
    data: {
      status: 'COMPLETED',
      matchedCount,
      discrepancyCount,
      completedAt: new Date(),
    },
  });

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'StatementImport',
    entityId: statement.id,
    action: AUDIT_ACTIONS.RECONCILIATION_IMPORTED,
    after: { rowCount: rows.length, matchedCount, discrepancyCount },
  });

  return finalStatement;
}

type MatchOutcome = 'matched' | 'discrepancy' | 'unmatched';

/**
 * Match a single statement row to a ledger entry.
 *
 * Resolution order:
 *  1. by courier waybill (primary key),
 *  2. fallback by `Delivery.orderRef` (tenant-scoped, guarded against ambiguous
 *     matches),
 *  3. fallback by tracking barcode matching a delivery orderRef/waybill.
 * The match method is recorded on the ledger entry for auditability.
 */
async function matchStatementRow(
  tenantId: string,
  row: RemittanceParsedRow,
  statementId: string,
): Promise<MatchOutcome> {
  if (row.waybill) {
    const byWaybill = await prisma.reconciliationLedgerEntry.findFirst({
      where: { tenantId, waybillId: row.waybill },
    });
    if (byWaybill) {
      if (byWaybill.statementImportId) return 'matched'; // already settled → idempotent
      return settleEntry(byWaybill.id, row, statementId, 'WAYBILL');
    }
  }

  // Fallback: order reference.
  if (row.orderRef) {
    const byOrderRef = await prisma.reconciliationLedgerEntry.findMany({
      where: { tenantId, delivery: { orderRef: row.orderRef } },
    });
    if (byOrderRef.length === 1) {
      return settleEntry(byOrderRef[0]!.id, row, statementId, 'ORDER_REF');
    }
    if (byOrderRef.length > 1) {
      // Ambiguous — flag the first for manual review rather than silently picking.
      const target = byOrderRef.find((e) => !e.statementImportId) ?? byOrderRef[0];
      if (target) {
        await prisma.reconciliationLedgerEntry.update({
          where: { id: target.id },
          data: {
            status: 'DISCREPANCY',
            matchMethod: 'AMBIGUOUS',
            statementImportId: statementId,
            discrepancyNote: `Ambiguous order reference "${row.orderRef}" matches multiple ledger entries`,
          },
        });
        return 'discrepancy';
      }
    }
  }

  // Fallback: tracking barcode matching an orderRef/waybill.
  if (row.barcode) {
    const byBarcode = await prisma.reconciliationLedgerEntry.findFirst({
      where: {
        tenantId,
        OR: [{ waybillId: row.barcode }, { delivery: { orderRef: row.barcode } }],
      },
    });
    if (byBarcode) {
      return settleEntry(byBarcode.id, row, statementId, 'BARCODE');
    }
  }

  // No match — surfaced as an unreconciled row (counted in the import summary).
  return 'unmatched';
}

/**
 * Settle a matched ledger entry against a statement row. When the remitted
 * amount equals expected COD, the entry clears; otherwise it is flagged as a
 * discrepancy with a classified failure-mode category. Returns the outcome.
 *
 * Also computes and persists the expected net payout (doc 15) and the
 * contract-compliance audit of courier deductions (doc 16) at match time.
 */
async function settleEntry(
  entryId: string,
  row: RemittanceParsedRow,
  statementId: string,
  matchMethod: 'WAYBILL' | 'ORDER_REF' | 'BARCODE',
): Promise<MatchOutcome> {
  const entry = await prisma.reconciliationLedgerEntry.findUnique({
    where: { id: entryId },
    include: { delivery: { select: { shippingFee: true } } },
  });
  if (!entry || entry.statementImportId) return 'matched';

  const expected = Number(entry.expectedCod.toString());
  const settledAmount = row.amount ? Number(row.amount) : null;
  const statedFees = row.fees ? Number(row.fees) : null;
  const deliveryFee = entry.delivery?.shippingFee ?? null;

  // Doc 15: expected net payout + deduction breakdown (single source of truth).
  const netBreakdown = await computeNetPayoutBreakdown({
    tenantId: entry.tenantId,
    grossCod: entry.expectedCod,
    deliveryFee,
  });

  // Doc 16: contract-compliance audit of the courier's stated deduction.
  const audit = await auditDeductionCompliance({
    tenantId: entry.tenantId,
    grossCod: entry.expectedCod,
    deliveryFee,
    actualDeduction: statedFees,
  });

  // Doc 14 feed: an over-charge is classified as an unauthorized deduction.
  const effectiveCategory =
    audit.auditStatus === 'OVER_CHARGED' ? 'UNAUTHORIZED_DEDUCTION' : null;

  if (settledAmount !== null && !isDiscrepant(expected, settledAmount)) {
    await prisma.reconciliationLedgerEntry.update({
      where: { id: entryId },
      data: {
        status: 'CLEARED',
        matchMethod,
        expectedFee: deliveryFee ? new Prisma.Decimal(deliveryFee.toString()).toFixed(2) : null,
        expectedNetPayout: netBreakdown.expectedNetPayout,
        codCommissionAmount: netBreakdown.codCommissionAmount,
        vatAmount: netBreakdown.vatAmount,
        auditStatus: audit.auditStatus,
        expectedDeduction: audit.expectedDeduction,
        actualDeduction: audit.actualDeduction,
        deductionVariance: audit.deductionVariance,
        settledAmount,
        settledAt: row.date ? new Date(row.date) : new Date(),
        statementImportId: statementId,
        discrepancyCategory: null,
        discrepancyNote: null,
        discrepancyAmount: null,
      },
    });
    return 'matched';
  }

  const classification = classifyDiscrepancy({ expectedCod: expected, settledAmount, statedFees });
  const category = effectiveCategory ?? classification.category;
  await prisma.reconciliationLedgerEntry.update({
    where: { id: entryId },
    data: {
      status: settledAmount === null ? 'DISCREPANCY' : 'PARTIAL_MATCH',
      matchMethod,
      expectedFee: deliveryFee ? new Prisma.Decimal(deliveryFee.toString()).toFixed(2) : null,
      expectedNetPayout: netBreakdown.expectedNetPayout,
      codCommissionAmount: netBreakdown.codCommissionAmount,
      vatAmount: netBreakdown.vatAmount,
      auditStatus: audit.auditStatus,
      expectedDeduction: audit.expectedDeduction,
      actualDeduction: audit.actualDeduction,
      deductionVariance: audit.deductionVariance,
      settledAmount,
      statementImportId: statementId,
      discrepancyCategory: category,
      discrepancyAmount: classification.variance,
      discrepancyNote:
        category === 'UNAUTHORIZED_DEDUCTION' && audit.auditStatus === 'OVER_CHARGED'
          ? `Courier over-charged ${audit.deductionVariance} above the contract terms`
          : classification.reason,
    },
  });
  return 'discrepancy';
}
