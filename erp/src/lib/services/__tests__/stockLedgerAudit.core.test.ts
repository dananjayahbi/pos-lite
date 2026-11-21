import { describe, expect, it } from 'vitest';
import {
  auditStockLedger,
  auditStockLedgerVariant,
  hasStockLedgerFindings,
  sortLedgerMovements,
  type LedgerMovementInput,
} from '@/lib/services/stockLedgerAudit.core';

function movement(overrides: Partial<LedgerMovementInput> & Pick<LedgerMovementInput, 'id'>): LedgerMovementInput {
  return {
    variantId: 'v1',
    reason: 'INITIAL_STOCK',
    quantityDelta: 0,
    quantityBefore: 0,
    quantityAfter: 0,
    createdAt: '2026-08-19T10:00:00.000Z',
    ...overrides,
  };
}

function variant(overrides: Partial<Parameters<typeof auditStockLedgerVariant>[0]> = {}) {
  return {
    variantId: 'v1',
    sku: 'BAI-08-OIL-100ML',
    productName: 'Bai Oil 100ml',
    currentQuantity: 0,
    movements: [] as LedgerMovementInput[],
    ...overrides,
  };
}

describe('sortLedgerMovements', () => {
  it('orders by createdAt and breaks ties by id', () => {
    const sorted = sortLedgerMovements([
      movement({ id: 'b', createdAt: '2026-08-20T00:00:00.000Z' }),
      movement({ id: 'z', createdAt: '2026-08-19T00:00:00.000Z' }),
      movement({ id: 'a', createdAt: '2026-08-19T00:00:00.000Z' }),
    ]);

    expect(sorted.map((row) => row.id)).toEqual(['a', 'z', 'b']);
  });

  it('does not mutate the input array', () => {
    const rows = [movement({ id: 'b' }), movement({ id: 'a' })];
    sortLedgerMovements(rows);
    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
  });
});

describe('auditStockLedgerVariant', () => {
  it('accepts a consistent chain that ends at current stock', () => {
    const audit = auditStockLedgerVariant(
      variant({
        currentQuantity: 40,
        movements: [
          movement({ id: 'm1', quantityBefore: 0, quantityDelta: 40, quantityAfter: 40 }),
        ],
      }),
    );

    expect(audit.chainBreaks).toEqual([]);
    expect(audit.arithmeticErrors).toEqual([]);
    expect(audit.currentMismatch).toBeNull();
    expect(audit.repairDelta).toBeNull();
    expect(audit.requiresManualReview).toBe(false);
    expect(audit.unexplainedOpening).toBe(false);
  });

  // ARGUS #198 — BAI-08-OIL-100ML: initial 0 -> 29, then a sale that starts at 50.
  it('reports a mid-chain break and the units that appeared out of nowhere', () => {
    const audit = auditStockLedgerVariant(
      variant({
        currentQuantity: 49,
        movements: [
          movement({ id: 'm1', quantityBefore: 0, quantityDelta: 29, quantityAfter: 29 }),
          movement({
            id: 'm2',
            reason: 'SALE',
            quantityBefore: 50,
            quantityDelta: -1,
            quantityAfter: 49,
            createdAt: '2026-11-15T10:00:00.000Z',
          }),
        ],
      }),
    );

    expect(audit.chainBreaks).toHaveLength(1);
    expect(audit.chainBreaks[0]).toMatchObject({
      movementId: 'm2',
      expectedBefore: 29,
      actualBefore: 50,
      gap: 21,
      reason: 'SALE',
    });
    // Current stock matches the ledger tail, so there is nothing for a repair
    // movement to append — only the historical gap remains.
    expect(audit.currentMismatch).toBeNull();
    expect(audit.repairDelta).toBeNull();
    expect(audit.requiresManualReview).toBe(true);
  });

  // ARGUS #198 — HIM-00-POW-500G: one initial 0 -> 2 row, current stock 50.
  it('reports a current mismatch against the ledger tail', () => {
    const audit = auditStockLedgerVariant(
      variant({
        variantId: 'v2',
        sku: 'HIM-00-POW-500G',
        currentQuantity: 50,
        movements: [
          movement({
            id: 'm1',
            variantId: 'v2',
            quantityBefore: 0,
            quantityDelta: 2,
            quantityAfter: 2,
          }),
        ],
      }),
    );

    expect(audit.currentMismatch).toEqual({
      variantId: 'v2',
      sku: 'HIM-00-POW-500G',
      currentQuantity: 50,
      lastQuantityAfter: 2,
      gap: 48,
    });
    expect(audit.repairDelta).toBe(48);
    expect(audit.chainBreaks).toEqual([]);
  });

  it('flags a variant with stock and no movements at all', () => {
    const audit = auditStockLedgerVariant(variant({ currentQuantity: 7 }));

    expect(audit.currentMismatch).toEqual({
      variantId: 'v1',
      sku: 'BAI-08-OIL-100ML',
      currentQuantity: 7,
      lastQuantityAfter: null,
      gap: 7,
    });
    expect(audit.repairDelta).toBe(7);
    expect(audit.firstQuantityBefore).toBeNull();
  });

  it('reports arithmetic errors separately from chain breaks', () => {
    const audit = auditStockLedgerVariant(
      variant({
        currentQuantity: 10,
        movements: [
          movement({ id: 'm1', quantityBefore: 0, quantityDelta: 10, quantityAfter: 10 }),
          movement({ id: 'm2', quantityBefore: 10, quantityDelta: -5, quantityAfter: 9 }),
        ],
      }),
    );

    expect(audit.arithmeticErrors).toHaveLength(1);
    expect(audit.arithmeticErrors[0]).toMatchObject({
      movementId: 'm2',
      quantityBefore: 10,
      quantityDelta: -5,
      quantityAfter: 9,
    });
    expect(audit.chainBreaks).toEqual([]);
    expect(audit.requiresManualReview).toBe(true);
  });

  it('marks an opening balance that predates the ledger as informational only', () => {
    const audit = auditStockLedgerVariant(
      variant({
        currentQuantity: 3,
        movements: [
          movement({ id: 'm1', reason: 'SALE', quantityBefore: 5, quantityDelta: -2, quantityAfter: 3 }),
        ],
      }),
    );

    expect(audit.unexplainedOpening).toBe(true);
    expect(audit.chainBreaks).toEqual([]);
    expect(audit.currentMismatch).toBeNull();
  });
});

describe('auditStockLedger', () => {
  const consistent = variant({
    variantId: 'v1',
    sku: 'OK-1',
    currentQuantity: 5,
    movements: [movement({ id: 'm1', quantityBefore: 0, quantityDelta: 5, quantityAfter: 5 })],
  });
  const brokenTail = variant({
    variantId: 'v2',
    sku: 'GAP-1',
    currentQuantity: 50,
    movements: [movement({ id: 'm2', variantId: 'v2', quantityBefore: 0, quantityDelta: 2, quantityAfter: 2 })],
  });
  const brokenChain = variant({
    variantId: 'v3',
    sku: 'BREAK-1',
    currentQuantity: 4,
    movements: [
      movement({ id: 'm3', variantId: 'v3', quantityBefore: 0, quantityDelta: 20, quantityAfter: 20 }),
      movement({
        id: 'm4',
        variantId: 'v3',
        reason: 'SALE',
        quantityBefore: 4,
        quantityDelta: 0,
        quantityAfter: 4,
        createdAt: '2026-11-15T10:00:00.000Z',
      }),
    ],
  });

  it('summarises totals and reason coverage', () => {
    const report = auditStockLedger([consistent, brokenTail, brokenChain]);

    expect(report.totals).toEqual({
      variants: 3,
      movements: 4,
      chainBreaks: 1,
      chainBreakVariants: 1,
      arithmeticErrors: 0,
      currentMismatches: 1,
      currentMismatchVariants: 1,
      unexplainedOpenings: 0,
      repairUnitsToAdd: 48,
      repairUnitsToRemove: 0,
    });
    expect(report.reasonCoverage).toEqual({ INITIAL_STOCK: 3, SALE: 1 });
    expect(hasStockLedgerFindings(report)).toBe(true);
  });

  it('reports no findings for a fully reconciled set', () => {
    const report = auditStockLedger([consistent]);
    expect(hasStockLedgerFindings(report)).toBe(false);
  });

  it('counts removals separately when current stock is below the tail', () => {
    const report = auditStockLedger([
      variant({
        currentQuantity: 5,
        movements: [movement({ id: 'm1', quantityBefore: 0, quantityDelta: 10, quantityAfter: 10 })],
      }),
    ]);

    expect(report.totals.repairUnitsToAdd).toBe(0);
    expect(report.totals.repairUnitsToRemove).toBe(5);
  });
});
