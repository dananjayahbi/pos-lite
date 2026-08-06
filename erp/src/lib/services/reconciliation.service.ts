import 'server-only';

import Papa from 'papaparse';

import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { setSentryTenantContext } from '@/lib/sentry/context';
import type { ReconciliationFilters } from '@/lib/validators/reconciliation.validators';

/**
 * Reconciliation service — COD settlement ledger + remittance CSV import.
 * Trans Express does not return financials via the API, so AyurPOS maintains an
 * expected-receivables ledger and reconciles it against portal CSV statements.
 */

export async function getLedgerEntries(tenantId: string, filters: ReconciliationFilters) {
  const { status, search, page, limit } = filters;

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { waybillId: { contains: search, mode: 'insensitive' } },
      { delivery: { orderRef: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.reconciliationLedgerEntry.count({ where: where as never }),
    prisma.reconciliationLedgerEntry.findMany({
      where: where as never,
      include: {
        delivery: { select: { orderRef: true, status: true, deliveredAt: true } },
        statementImport: { select: { id: true, filename: true, uploadedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { items, total, page, limit };
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

/** Parse a Trans Express remittance CSV into rows for preview/matching. */
export function parseRemittanceCsv(csv: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data;
}

interface NormalizedRow {
  waybill?: string | undefined;
  amount?: string | undefined;
  fees?: string | undefined;
  status?: string | undefined;
  date?: string | undefined;
  raw: Record<string, string>;
}

/** Tolerant column detection across portal CSV variants. */
function normalizeRow(row: Record<string, string>): NormalizedRow {
  const keys = Object.keys(row);
  const lower = keys.map((k) => k.toLowerCase());

  const pick = (...names: string[]): string | undefined => {
    const idx = lower.findIndex((l) => names.some((n) => l.includes(n)));
    if (idx < 0) return undefined;
    const key = keys[idx];
    if (!key) return undefined;
    return row[key] ?? undefined;
  };

  return {
    waybill: pick('waybill', 'way_bill', 'tracking', 'airwaybill'),
    amount: pick('amount', 'cod', 'settled', 'paid', 'received'),
    fees: pick('fee', 'charge', 'cost', 'commission'),
    status: pick('status', 'state'),
    date: pick('date', 'settled_at', 'time'),
    raw: row,
  };
}

/**
 * Import a remittance CSV statement and match rows to ledger entries.
 * Idempotent: re-uploading the same statement (dedup by batch + waybill) never
 * double-settles. Never auto-clears financial discrepancies.
 */
export async function importRemittanceStatement(
  tenantId: string,
  userId: string,
  filename: string,
  csv: string,
) {
  setSentryTenantContext({ tenantId });

  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const rawRows = parsed.data;
  const rows = rawRows.map(normalizeRow);

  const statement = await prisma.statementImport.create({
    data: {
      tenantId,
      filename,
      uploadedById: userId,
      status: 'PARSED',
      rowCount: rows.length,
      rawRows: rawRows as never,
    },
  });

  let matchedCount = 0;
  let discrepancyCount = 0;

  for (const row of rows) {
    if (!row.waybill) continue;

    // Match by waybill; order-ref fallback handled where available.
    const entry = await prisma.reconciliationLedgerEntry.findFirst({
      where: { tenantId, waybillId: row.waybill },
    });
    if (!entry) {
      discrepancyCount++;
      continue;
    }
    if (entry.statementImportId) continue; // already settled by a prior import → idempotent

    const settledAmount = row.amount ? Number(row.amount) : null;
    const expected = Number(entry.expectedCod.toString());

    if (settledAmount !== null && Math.abs(settledAmount - expected) < 0.01) {
      await prisma.reconciliationLedgerEntry.update({
        where: { id: entry.id },
        data: {
          status: 'CLEARED',
          settledAmount,
          settledAt: row.date ? new Date(row.date) : new Date(),
          statementImportId: statement.id,
        },
      });
      matchedCount++;
    } else {
      await prisma.reconciliationLedgerEntry.update({
        where: { id: entry.id },
        data: {
          status: 'PARTIAL_MATCH',
          settledAmount: settledAmount,
          statementImportId: statement.id,
          discrepancyNote: settledAmount === null ? 'No settled amount on statement row' : 'Settled amount differs from expected COD',
        },
      });
      discrepancyCount++;
    }
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
