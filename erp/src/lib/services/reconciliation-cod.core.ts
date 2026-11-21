import { collectableCodAmount } from '@/lib/delivery/cod';

/**
 * ARGUS #511 — COD reconciliation entry planner.
 *
 * A delivered COD delivery must have exactly one reconciliation ledger entry.
 * The receivable is the collectable total (goods + shipping) for COD/unpaid
 * parcels; a PAID parcel collects nothing. Backfill is dry-run by default and
 * only plans rows that do not already have an entry.
 */
export interface CodBackfillRow {
  id: string;
  tenantId: string;
  orderRef: string;
  status: string;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
  codAmount: string | number | { toString(): string } | null | undefined;
  shippingFee?: string | number | { toString(): string } | null | undefined;
  hasEntry: boolean;
  waybillId?: string | null | undefined;
}

export type CodBackfillAction = 'create' | 'skip-existing' | 'skip-not-eligible';

export interface CodBackfillPlan {
  action: CodBackfillAction;
  expectedCod: string | null;
  reason: string | null;
}

/** True when a delivery is a delivered, unpaid COD parcel with money to collect. */
export function isDeliveredCodReceivable(row: Omit<CodBackfillRow, 'hasEntry'>): boolean {
  if (row.status !== 'DELIVERED') return false;
  if (row.paymentMethod !== 'COD') return false;
  if (row.paymentStatus === 'PAID') return false;
  return collectableCodAmount(row).greaterThan(0);
}

export function planCodBackfillRow(row: CodBackfillRow): CodBackfillPlan {
  if (row.hasEntry) {
    return { action: 'skip-existing', expectedCod: null, reason: 'Already has a ledger entry' };
  }
  if (!isDeliveredCodReceivable(row)) {
    return { action: 'skip-not-eligible', expectedCod: null, reason: 'Not a delivered unpaid COD parcel' };
  }
  return {
    action: 'create',
    expectedCod: collectableCodAmount(row).toFixed(2),
    reason: null,
  };
}

export function summarizeCodBackfill(
  rows: ReadonlyArray<CodBackfillRow>,
): {
  createCount: number;
  existingCount: number;
  skippedCount: number;
  totalExpected: string;
  plans: Array<CodBackfillPlan & { id: string }>;
} {
  let createCount = 0;
  let existingCount = 0;
  let skippedCount = 0;
  let total = 0;
  const plans: Array<CodBackfillPlan & { id: string }> = [];

  for (const row of rows) {
    const plan = planCodBackfillRow(row);
    plans.push({ id: row.id, ...plan });
    if (plan.action === 'create') {
      createCount += 1;
      total += Number(plan.expectedCod);
    } else if (plan.action === 'skip-existing') {
      existingCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    createCount,
    existingCount,
    skippedCount,
    totalExpected: total.toFixed(2),
    plans,
  };
}
