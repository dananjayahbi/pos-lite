import { describe, expect, it } from 'vitest';

import { resolveStockMovementSource } from '@/lib/stock/movement-source';

/**
 * ARGUS #199 - a movement with a source reference must be explainable in the
 * table and CSV.
 */
describe('stock movement source resolution', () => {
  const saleId = '11111111-1111-1111-1111-111111111111';
  const poId = '22222222-2222-2222-2222-222222222222';
  const sessionId = '33333333-3333-3333-3333-333333333333';
  const batchId = '44444444-4444-4444-4444-444444444444';
  const variantId = '55555555-5555-5555-5555-555555555555';

  it('returns null for a manual movement with no source', () => {
    expect(
      resolveStockMovementSource({
        saleId: null,
        purchaseOrderId: null,
        stockTakeSessionId: null,
        batchId: null,
      }),
    ).toBeNull();
  });

  it('links a sale movement to the sale page', () => {
    expect(resolveStockMovementSource({ saleId })).toEqual({
      kind: 'sale',
      label: 'Sale',
      id: saleId,
      reference: '11111111',
      href: `/sales/${saleId}`,
    });
  });

  it('links a purchase movement to the purchase-order page', () => {
    expect(resolveStockMovementSource({ purchaseOrderId: poId })).toMatchObject({
      kind: 'purchase-order',
      label: 'Purchase Order',
      id: poId,
      href: `/suppliers/purchase-orders/${poId}`,
    });
  });

  it('links a stock-take movement to the session page', () => {
    expect(resolveStockMovementSource({ stockTakeSessionId: sessionId })).toMatchObject({
      kind: 'stock-take',
      label: 'Stock Take',
      id: sessionId,
      href: `/stock-control/stock-takes/${sessionId}`,
    });
  });

  it('links a batch movement to the variant-filtered batch list', () => {
    expect(resolveStockMovementSource({ batchId, variantId })).toMatchObject({
      kind: 'batch',
      label: 'Batch',
      id: batchId,
      href: `/inventory/batches?variantId=${variantId}`,
    });
  });

  it('falls back to the unfiltered batch list without a variant id', () => {
    expect(resolveStockMovementSource({ batchId })).toMatchObject({
      kind: 'batch',
      href: '/inventory/batches',
    });
  });

  it('uses a deterministic priority when several references exist', () => {
    expect(
      resolveStockMovementSource({
        saleId,
        purchaseOrderId: poId,
        stockTakeSessionId: sessionId,
        batchId,
      })?.kind,
    ).toBe('sale');
    expect(
      resolveStockMovementSource({ purchaseOrderId: poId, batchId })?.kind,
    ).toBe('purchase-order');
    expect(resolveStockMovementSource({ stockTakeSessionId: sessionId, batchId })?.kind).toBe(
      'stock-take',
    );
  });
});
