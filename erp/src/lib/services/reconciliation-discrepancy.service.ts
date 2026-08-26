import "server-only";

import type { DiscrepancyCategory } from "@/generated/prisma/client";

/**
 * Pure discrepancy classifier for reconciliation.
 *
 * Given the expected COD, the amount actually remitted on the statement, and any
 * stated fee/deduction, returns the failure-mode category + a human reason.
 * This is kept dependency-free so it can be unit-tested in isolation.
 */

export interface DiscrepancyInput {
  expectedCod: number;
  /** Amount remitted on the statement (null when no payment present). */
  settledAmount: number | null;
  /** Total fees/deductions stated on the statement row (optional). */
  statedFees?: number | null | undefined;
}

export interface DiscrepancyClassification {
  category: DiscrepancyCategory;
  /** Signed variance: expected − (settled + statedFees). */
  variance: number;
  reason: string;
}

/** Whether the row is discrepant (differs from expected COD beyond tolerance). */
export function isDiscrepant(
  expectedCod: number,
  settledAmount: number | null,
  tolerance = 0.01,
): boolean {
  if (settledAmount === null) return true; // nothing received
  return Math.abs(settledAmount - expectedCod) >= tolerance;
}

/**
 * Classify the failure mode of a discrepant row:
 * - No remittance at all → UNPAID
 * - Remitted more than expected → OVER_RECEIVED
 * - Remitted less: a stated fee not part of expected → UNAUTHORIZED_DEDUCTION,
 *   otherwise UNDERPAID.
 */
export function classifyDiscrepancy(input: DiscrepancyInput): DiscrepancyClassification {
  const { expectedCod, settledAmount, statedFees } = input;
  const fee = statedFees ?? 0;

  if (settledAmount === null) {
    return {
      category: "UNPAID",
      variance: expectedCod,
      reason: "No remittance recorded on the statement for this order",
    };
  }

  if (settledAmount > expectedCod + 0.01) {
    return {
      category: "OVER_RECEIVED",
      variance: settledAmount - expectedCod,
      reason: `Remitted ${settledAmount.toFixed(2)} exceeds expected COD ${expectedCod.toFixed(2)}`,
    };
  }

  // Underpaid (settled < expected). If the statement shows a deduction was
  // taken, treat it as an unauthorized deduction not covered by the terms.
  if (fee > 0) {
    return {
      category: "UNAUTHORIZED_DEDUCTION",
      variance: expectedCod - settledAmount - fee,
      reason: `Stated deduction of ${fee.toFixed(2)} is not covered by the configured terms`,
    };
  }

  return {
    category: "UNDERPAID",
    variance: expectedCod - settledAmount,
    reason: `Remitted ${settledAmount.toFixed(2)} is less than expected COD ${expectedCod.toFixed(2)}`,
  };
}
