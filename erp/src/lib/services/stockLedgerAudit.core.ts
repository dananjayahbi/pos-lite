/**
 * Pure stock-ledger reconciliation helpers (ARGUS #198).
 *
 * The StockMovement ledger is append-only: each row records the quantity
 * before and after its own change. That makes a variant's history a chain —
 * `movement[i].quantityBefore === movement[i-1].quantityAfter` — whose final
 * link must equal `ProductVariant.stockQuantity`.
 *
 * These helpers only compare; they never write. The audit script
 * (`scripts/audit-stock-ledger.ts`) and the repair CLI
 * (`scripts/repair-stock-ledger.ts`) share them so the report and the repair
 * always agree on what "inconsistent" means.
 */

export interface LedgerMovementInput {
  id: string;
  variantId: string;
  reason: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: Date | string;
  note?: string | null;
}

export interface LedgerVariantInput {
  variantId: string;
  sku: string;
  productName?: string | null;
  currentQuantity: number;
  movements: LedgerMovementInput[];
}

export interface StockLedgerChainBreak {
  variantId: string;
  sku: string;
  movementId: string;
  reason: string;
  createdAt: string;
  /** Previous movement's `quantityAfter` — what this row should have started at. */
  expectedBefore: number;
  /** What the row actually starts at. */
  actualBefore: number;
  /** `actualBefore - expectedBefore`: positive means stock appeared unexplained. */
  gap: number;
}

export interface StockLedgerArithmeticError {
  variantId: string;
  sku: string;
  movementId: string;
  reason: string;
  createdAt: string;
  quantityBefore: number;
  quantityDelta: number;
  quantityAfter: number;
}

export interface StockLedgerCurrentMismatch {
  variantId: string;
  sku: string;
  currentQuantity: number;
  /** Last movement's `quantityAfter`; null when the variant has no rows. */
  lastQuantityAfter: number | null;
  /** `currentQuantity - lastQuantityAfter` (0 when there is no ledger). */
  gap: number;
}

export interface StockLedgerVariantAudit {
  variantId: string;
  sku: string;
  productName: string | null;
  currentQuantity: number;
  movementCount: number;
  /** Distinct movement reasons, in first-seen order. */
  reasons: string[];
  firstQuantityBefore: number | null;
  lastQuantityAfter: number | null;
  chainBreaks: StockLedgerChainBreak[];
  arithmeticErrors: StockLedgerArithmeticError[];
  /** Present only when current stock disagrees with the ledger tail. */
  currentMismatch: StockLedgerCurrentMismatch | null;
  /**
   * Delta a DATA_ERROR movement would need to append to make the ledger end at
   * the current stock; null when no repair is needed.
   */
  repairDelta: number | null;
  /**
   * True when appending a row cannot fully explain the history (a break or an
   * arithmetically impossible row remains); the tail can still be pinned.
   */
  requiresManualReview: boolean;
  /**
   * Informational: a first movement that starts above/below zero means stock
   * predates the ledger. Not counted as a chain break (there is no previous
   * row), so --strict does not fail on it alone.
   */
  unexplainedOpening: boolean;
}

export interface StockLedgerTotals {
  variants: number;
  movements: number;
  chainBreaks: number;
  chainBreakVariants: number;
  arithmeticErrors: number;
  currentMismatches: number;
  currentMismatchVariants: number;
  unexplainedOpenings: number;
  /** Units that would be added by repairs (sum of positive repair deltas). */
  repairUnitsToAdd: number;
  /** Units that would be removed by repairs (sum of |negative repair deltas|). */
  repairUnitsToRemove: number;
}

export interface StockLedgerReport {
  variants: StockLedgerVariantAudit[];
  totals: StockLedgerTotals;
  /** Movement counts by reason, across every scanned variant. */
  reasonCoverage: Record<string, number>;
}

function timeValue(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/** Oldest first; `id` breaks createdAt ties deterministically. */
export function sortLedgerMovements<T extends LedgerMovementInput>(movements: readonly T[]): T[] {
  return [...movements].sort((a, b) => {
    const byTime = timeValue(a.createdAt) - timeValue(b.createdAt);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
}

function toIsoString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function auditStockLedgerVariant(input: LedgerVariantInput): StockLedgerVariantAudit {
  const movements = sortLedgerMovements(input.movements);
  const chainBreaks: StockLedgerChainBreak[] = [];
  const arithmeticErrors: StockLedgerArithmeticError[] = [];
  const reasons: string[] = [];

  for (let index = 0; index < movements.length; index += 1) {
    const movement = movements[index]!;

    if (!reasons.includes(movement.reason)) reasons.push(movement.reason);

    if (movement.quantityBefore + movement.quantityDelta !== movement.quantityAfter) {
      arithmeticErrors.push({
        variantId: input.variantId,
        sku: input.sku,
        movementId: movement.id,
        reason: movement.reason,
        createdAt: toIsoString(movement.createdAt),
        quantityBefore: movement.quantityBefore,
        quantityDelta: movement.quantityDelta,
        quantityAfter: movement.quantityAfter,
      });
    }

    const previous = index > 0 ? movements[index - 1]! : null;
    if (previous && movement.quantityBefore !== previous.quantityAfter) {
      chainBreaks.push({
        variantId: input.variantId,
        sku: input.sku,
        movementId: movement.id,
        reason: movement.reason,
        createdAt: toIsoString(movement.createdAt),
        expectedBefore: previous.quantityAfter,
        actualBefore: movement.quantityBefore,
        gap: movement.quantityBefore - previous.quantityAfter,
      });
    }
  }

  const first = movements[0] ?? null;
  const last = movements[movements.length - 1] ?? null;
  const lastQuantityAfter = last ? last.quantityAfter : null;
  const ledgerTail = lastQuantityAfter ?? 0;
  const gap = input.currentQuantity - ledgerTail;

  return {
    variantId: input.variantId,
    sku: input.sku,
    productName: input.productName ?? null,
    currentQuantity: input.currentQuantity,
    movementCount: movements.length,
    reasons,
    firstQuantityBefore: first ? first.quantityBefore : null,
    lastQuantityAfter,
    chainBreaks,
    arithmeticErrors,
    currentMismatch:
      gap === 0
        ? null
        : {
            variantId: input.variantId,
            sku: input.sku,
            currentQuantity: input.currentQuantity,
            lastQuantityAfter,
            gap,
          },
    repairDelta: gap === 0 ? null : gap,
    requiresManualReview: chainBreaks.length > 0 || arithmeticErrors.length > 0,
    unexplainedOpening: first !== null && first.quantityBefore !== 0,
  };
}

export function auditStockLedger(variants: readonly LedgerVariantInput[]): StockLedgerReport {
  const audits = variants.map((variant) => auditStockLedgerVariant(variant));
  const reasonCoverage: Record<string, number> = {};

  for (const variant of variants) {
    for (const movement of variant.movements) {
      reasonCoverage[movement.reason] = (reasonCoverage[movement.reason] ?? 0) + 1;
    }
  }

  const totals: StockLedgerTotals = {
    variants: audits.length,
    movements: audits.reduce((sum, audit) => sum + audit.movementCount, 0),
    chainBreaks: audits.reduce((sum, audit) => sum + audit.chainBreaks.length, 0),
    chainBreakVariants: audits.filter((audit) => audit.chainBreaks.length > 0).length,
    arithmeticErrors: audits.reduce((sum, audit) => sum + audit.arithmeticErrors.length, 0),
    currentMismatches: audits.filter((audit) => audit.currentMismatch !== null).length,
    currentMismatchVariants: audits.filter((audit) => audit.currentMismatch !== null).length,
    unexplainedOpenings: audits.filter((audit) => audit.unexplainedOpening).length,
    repairUnitsToAdd: audits.reduce(
      (sum, audit) => sum + (audit.repairDelta !== null && audit.repairDelta > 0 ? audit.repairDelta : 0),
      0,
    ),
    repairUnitsToRemove: audits.reduce(
      (sum, audit) => sum + (audit.repairDelta !== null && audit.repairDelta < 0 ? -audit.repairDelta : 0),
      0,
    ),
  };

  return { variants: audits, totals, reasonCoverage };
}

export function hasStockLedgerFindings(report: StockLedgerReport): boolean {
  return (
    report.totals.chainBreaks > 0 ||
    report.totals.arithmeticErrors > 0 ||
    report.totals.currentMismatches > 0
  );
}
