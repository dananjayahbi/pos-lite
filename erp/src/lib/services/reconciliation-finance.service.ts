import 'server-only';

import type Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { computeCourierFeeBreakdown } from '@/lib/delivery/courier-fees.core';
import { getActiveRateCard } from '@/lib/services/shipping-fee.service';
import type { DeductionAuditStatus } from '@/generated/prisma/client';

/**
 * Net-payout + contract-compliance finance helpers for reconciliation.
 *
 * Net payout (ARGUS #293):
 *   commission = grossCOD x COD%
 *   VAT        = (delivery fee + commission) x VAT%
 *   net        = grossCOD - delivery fee - commission - VAT
 * using the active RateCard contract terms and the delivery's shipping fee.
 * VAT is on the courier service, not on the cash collected.
 *
 * Contract-compliance audit (doc 16): compare the courier's stated deduction on
 * a statement row against the expected deduction re-derived from the RateCard.
 */

export interface NetPayoutBreakdown {
  /** Net expected payout (2dp string). */
  expectedNetPayout: string;
  /** COD commission amount (2dp string). */
  codCommissionAmount: string;
  /** VAT amount (2dp string): VAT% x (delivery fee + commission). */
  vatAmount: string;
  /** Explicit VAT base (2dp string): delivery fee + commission. */
  vatBase: string;
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
  const breakdown = computeCourierFeeBreakdown({
    grossCod: input.grossCod,
    deliveryFee: input.deliveryFee ?? null,
    coddCommissionPct: card?.coddCommissionPct ?? null,
    vatRatePct: card?.vatRatePct ?? null,
  });

  return {
    expectedNetPayout: breakdown.netPayout.toFixed(2),
    codCommissionAmount: breakdown.codCommission.toFixed(2),
    vatAmount: breakdown.vatAmount.toFixed(2),
    vatBase: breakdown.vatBase.toFixed(2),
    deliveryFee: breakdown.deliveryFee.toFixed(2),
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
 * deduction (fee + COD%·gross + VAT%·(fee + commission)). Returns COMPLIANT
 * when within tolerance, OVER_CHARGED when the courier deducted more,
 * UNDER_CHARGED when less.
 */
export async function auditDeductionCompliance(
  input: AuditComparisonInput,
): Promise<AuditComparisonResult> {
  const card = await getActiveRateCard(input.tenantId);
  const breakdown = computeCourierFeeBreakdown({
    grossCod: input.grossCod,
    deliveryFee: input.deliveryFee ?? null,
    coddCommissionPct: card?.coddCommissionPct ?? null,
    vatRatePct: card?.vatRatePct ?? null,
  });

  const expectedDeduction = breakdown.totalDeduction.toNumber();
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
