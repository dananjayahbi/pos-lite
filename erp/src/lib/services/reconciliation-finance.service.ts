import 'server-only';

import type Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { computeNetPayout } from '@/lib/services/rate-engine.service';
import { getActiveRateCard } from '@/lib/services/shipping-fee.service';
import type { DeductionAuditStatus } from '@/generated/prisma/client';

/**
 * Net-payout + contract-compliance finance helpers for reconciliation.
 *
 * Net payout (doc 15): Net = grossCOD − (delivery fee + COD%·gross + VAT%·gross),
 * using the active RateCard contract terms and the delivery's shipping fee.
 *
 * Contract-compliance audit (doc 16): compare the courier's stated deduction on
 * a statement row against the expected deduction re-derived from the RateCard.
 */

export interface NetPayoutBreakdown {
  /** Net expected payout (2dp string). */
  expectedNetPayout: string;
  /** COD commission amount (2dp string). */
  codCommissionAmount: string;
  /** VAT amount (2dp string). */
  vatAmount: string;
  /** Delivery fee used in the calculation (2dp string). */
  deliveryFee: string;
}

/**
 * Compute the expected net-payout breakdown for a ledger entry's gross COD +
 * delivery fee using the tenant's active RateCard contract terms.
 * Falls back to zero commission/VAT when no active card exists.
 */
export async function computeNetPayoutBreakdown(input: {
  tenantId: string;
  grossCod: Decimal | string | number;
  deliveryFee?: Decimal | string | number | null;
}): Promise<NetPayoutBreakdown> {
  const card = await getActiveRateCard(input.tenantId);
  const coddCommissionPct = card?.coddCommissionPct ?? undefined;
  const vatRatePct = card?.vatRatePct ?? undefined;

  const net = computeNetPayout({
    grossCod: input.grossCod,
    deliveryFee: input.deliveryFee ?? null,
    coddCommissionPct: coddCommissionPct ?? null,
    vatRatePct: vatRatePct ?? null,
  });

  const gross = Number(input.grossCod.toString());
  const fee = Number(input.deliveryFee?.toString() ?? 0);
  const codPct = coddCommissionPct ? Number(coddCommissionPct.toString()) / 100 : 0;
  const vatPct = vatRatePct ? Number(vatRatePct.toString()) / 100 : 0;

  return {
    expectedNetPayout: net.toFixed(2),
    codCommissionAmount: (gross * codPct).toFixed(2),
    vatAmount: (gross * vatPct).toFixed(2),
    deliveryFee: fee.toFixed(2),
  };
}

export interface AuditComparisonInput {
  tenantId: string;
  grossCod: Decimal | string | number;
  /** Delivery fee used for pricing the order (part of expected deduction). */
  deliveryFee?: Decimal | string | number | null;
  /** Total deduction the courier actually reported on the statement row. */
  actualDeduction?: Decimal | string | number | null;
}

export interface AuditComparisonResult {
  auditStatus: DeductionAuditStatus;
  /** Expected total deduction re-derived from the contract (2dp string). */
  expectedDeduction: string;
  /** Courier-reported deduction (2dp string; 0 when absent). */
  actualDeduction: string;
  /** actual − expected (2dp string). */
  deductionVariance: string;
}

/**
 * Audit a single row's courier deduction against the expected contract
 * deduction (fee + COD%·gross + VAT%·gross). Returns COMPLIANT when within
 * tolerance, OVER_CHARGED when the courier deducted more, UNDER_CHARGED when less.
 */
export async function auditDeductionCompliance(
  input: AuditComparisonInput,
): Promise<AuditComparisonResult> {
  const card = await getActiveRateCard(input.tenantId);
  const coddCommissionPct = card?.coddCommissionPct ?? undefined;
  const vatRatePct = card?.vatRatePct ?? undefined;

  const gross = Number(input.grossCod.toString());
  const fee = Number(input.deliveryFee?.toString() ?? 0);
  const codPct = coddCommissionPct ? Number(coddCommissionPct.toString()) / 100 : 0;
  const vatPct = vatRatePct ? Number(vatRatePct.toString()) / 100 : 0;
  const expectedDeduction = fee + gross * codPct + gross * vatPct;

  const actual = Number(input.actualDeduction?.toString() ?? 0);
  const variance = actual - expectedDeduction;

  let status: DeductionAuditStatus = 'COMPLIANT';
  if (variance > 0.01) status = 'OVER_CHARGED';
  else if (variance < -0.01) status = 'UNDER_CHARGED';

  return {
    auditStatus: status,
    expectedDeduction: expectedDeduction.toFixed(2),
    actualDeduction: actual.toFixed(2),
    deductionVariance: variance.toFixed(2),
  };
}

/**
 * Pure classification of a deduction variance into an audit status. Kept
 * dependency-free so it can be unit-tested in isolation.
 */
export function classifyDeductionAudit(variance: number): DeductionAuditStatus {
  if (variance > 0.01) return 'OVER_CHARGED';
  if (variance < -0.01) return 'UNDER_CHARGED';
  return 'COMPLIANT';
}

/**
 * Contract-compliance audit report (doc 16). Summarizes counts and totals of
 * compliant / over-charged / under-charged ledger entries for a tenant, plus
 * the total variance and expected net payout across the audited set.
 */
export async function getAuditReport(tenantId: string) {
  const [grouped, totals] = await Promise.all([
    prisma.reconciliationLedgerEntry.groupBy({
      by: ['auditStatus'],
      where: { tenantId, auditStatus: { not: null } },
      _count: { _all: true },
      _sum: { deductionVariance: true, expectedNetPayout: true },
    }),
    prisma.reconciliationLedgerEntry.aggregate({
      where: { tenantId, auditStatus: { not: null } },
      _sum: { deductionVariance: true, expectedNetPayout: true },
    }),
  ]);

  const byStatus: Record<string, { count: number; variance: number; netPayout: number }> = {};
  for (const g of grouped) {
    if (!g.auditStatus) continue;
    byStatus[g.auditStatus] = {
      count: g._count._all,
      variance: Number(g._sum.deductionVariance?.toString() ?? 0),
      netPayout: Number(g._sum.expectedNetPayout?.toString() ?? 0),
    };
  }

  return {
    byStatus,
    totals: {
      audited: grouped.reduce((sum, g) => sum + g._count._all, 0),
      totalVariance: Number(totals._sum.deductionVariance?.toString() ?? 0),
      totalNetPayout: Number(totals._sum.expectedNetPayout?.toString() ?? 0),
    },
  };
}
