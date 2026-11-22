import { describe, expect, it } from 'vitest';
import {
  batchNumberMatchesLog,
  planProductionBatchRepairs,
  productionBatchSuffix,
  PRODUCTION_BATCH_MATCH_WINDOW_MS,
  type ProductionBatchRepairBatch,
  type ProductionBatchRepairLog,
  type ProductionBatchRepairMovement,
} from '@/lib/services/productionBatchRepair.core';
import { buildProductionBatchNumber } from '@/lib/services/bom.core';

const BASE = new Date('2026-11-01T08:00:00.000Z');

function at(offsetMs: number): Date {
  return new Date(BASE.getTime() + offsetMs);
}

function log(id: string, overrides: Partial<ProductionBatchRepairLog> = {}): ProductionBatchRepairLog {
  return { id, variantId: 'variant-1', quantity: 3, createdAt: BASE, ...overrides };
}

function movement(
  id: string,
  overrides: Partial<ProductionBatchRepairMovement> = {},
): ProductionBatchRepairMovement {
  return {
    id,
    variantId: 'variant-1',
    quantityDelta: 3,
    createdAt: BASE,
    batchId: null,
    ...overrides,
  };
}

function batch(
  id: string,
  logId: string,
  overrides: Partial<ProductionBatchRepairBatch> = {},
): ProductionBatchRepairBatch {
  return {
    id,
    variantId: 'variant-1',
    batchNumber: buildProductionBatchNumber(logId, BASE),
    ...overrides,
  };
}

function plan(
  logs: ProductionBatchRepairLog[],
  movements: ProductionBatchRepairMovement[],
  batches: ProductionBatchRepairBatch[] = [],
) {
  return planProductionBatchRepairs({ logs, movements, batches });
}

describe('productionBatchRepair.core - batch number matching', () => {
  it('derives the same suffix as the generated batch number', () => {
    const generated = buildProductionBatchNumber('cmabc123xyz789', BASE);
    expect(generated.endsWith(`-${productionBatchSuffix('cmabc123xyz789')}`)).toBe(true);
    expect(batchNumberMatchesLog(generated, 'cmabc123xyz789')).toBe(true);
  });

  it('matches a batch created on a different calendar day via the suffix', () => {
    const generated = buildProductionBatchNumber('cmabc123xyz789', new Date('2026-11-02T00:00:00Z'));
    expect(batchNumberMatchesLog(generated, 'cmabc123xyz789')).toBe(true);
  });

  it('does not match another run', () => {
    const generated = buildProductionBatchNumber('cmabc123xyz789', BASE);
    expect(batchNumberMatchesLog(generated, 'cmdifferent999')).toBe(false);
  });
});

describe('productionBatchRepair.core - planner', () => {
  it('pairs a legacy run with its unlinked movement and proposes a new batch', () => {
    const result = plan([log('log-1')], [movement('m-1')]);
    expect(result.repairs).toEqual([
      {
        logId: 'log-1',
        variantId: 'variant-1',
        quantity: 3,
        movementId: 'm-1',
        batchNumber: buildProductionBatchNumber('log-1', BASE),
        existingBatchId: null,
      },
    ]);
    expect(result.skipped).toEqual([]);
    expect(result.orphanMovementIds).toEqual([]);
  });

  it('skips a run that already has a batch-linked movement', () => {
    const result = plan(
      [log('log-1')],
      [movement('m-1', { batchId: 'batch-1' })],
      [batch('batch-1', 'log-1')],
    );
    expect(result.repairs).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ logId: 'log-1', reason: 'HAS_BATCH' });
  });

  it('links an existing batch when only the movement link is missing (crash recovery)', () => {
    const existing = batch('batch-1', 'log-1');
    const result = plan([log('log-1')], [movement('m-1')], [existing]);
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0]).toMatchObject({
      movementId: 'm-1',
      existingBatchId: 'batch-1',
      batchNumber: existing.batchNumber,
    });
  });

  it('reports a run with no nearby unlinked movement', () => {
    const result = plan([log('log-1')], []);
    expect(result.repairs).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ reason: 'NO_MOVEMENT' });
  });

  it('reports a quantity mismatch instead of guessing', () => {
    const result = plan([log('log-1')], [movement('m-1', { quantityDelta: 5 })]);
    expect(result.repairs).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ reason: 'QUANTITY_MISMATCH' });
    expect(result.orphanMovementIds).toEqual(['m-1']);
  });

  it('rejects a movement outside the match window', () => {
    const result = plan(
      [log('log-1')],
      [movement('m-1', { createdAt: at(PRODUCTION_BATCH_MATCH_WINDOW_MS + 1) })],
    );
    expect(result.repairs).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ reason: 'NO_MOVEMENT' });
  });

  it('tolerates a small negative clock skew', () => {
    const result = plan([log('log-1')], [movement('m-1', { createdAt: at(-30_000) })]);
    expect(result.repairs).toHaveLength(1);
  });

  it('marks two identical nearby runs as ambiguous and claims neither movement', () => {
    const result = plan(
      [log('log-1'), log('log-2')],
      [movement('m-1'), movement('m-2')],
    );
    expect(result.repairs).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual([
      'AMBIGUOUS_MOVEMENT',
      'AMBIGUOUS_MOVEMENT',
    ]);
    expect(result.orphanMovementIds).toEqual(['m-1', 'm-2']);
  });

  it('pairs identical quantities when the runs are far apart', () => {
    const later = at(60 * 60 * 1000);
    const result = plan(
      [log('log-1'), log('log-2', { createdAt: later })],
      [movement('m-1'), movement('m-2', { createdAt: later })],
    );
    expect(result.repairs).toHaveLength(2);
    expect(result.repairs.map((r) => r.movementId)).toEqual(['m-1', 'm-2']);
  });

  it('never assigns one movement to two logs', () => {
    const later = at(60 * 60 * 1000);
    const result = plan(
      [log('log-1'), log('log-2', { createdAt: later })],
      [movement('m-1')],
    );
    expect(result.repairs.map((r) => r.logId)).toEqual(['log-1']);
    expect(result.skipped).toHaveLength(1);
  });

  it('ignores movements of another variant and movements already linked elsewhere', () => {
    const result = plan(
      [log('log-1')],
      [
        movement('m-other-variant', { variantId: 'variant-2' }),
        movement('m-linked', { batchId: 'some-other-batch' }),
      ],
    );
    expect(result.repairs).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ reason: 'NO_MOVEMENT' });
  });

  it('does not report an unlinked movement as orphan when a repair claimed it', () => {
    const result = plan([log('log-1')], [movement('m-1')]);
    expect(result.orphanMovementIds).toEqual([]);
  });
});
