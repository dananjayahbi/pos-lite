/**
 * ARGUS #199 - resolve a StockMovement's source document.
 *
 * A movement row can reference a sale, purchase order, stock-take session or
 * batch. The Movement History table needs one human source to show and link,
 * while the CSV exposes every reference. Keeping the choice in a pure helper
 * makes the table and export agree.
 */

export type StockMovementSourceKind = 'sale' | 'purchase-order' | 'stock-take' | 'batch';

export interface StockMovementSourceIds {
  saleId?: string | null | undefined;
  purchaseOrderId?: string | null | undefined;
  stockTakeSessionId?: string | null | undefined;
  batchId?: string | null | undefined;
  /** Only needed to build the batch list link. */
  variantId?: string | null | undefined;
}

export interface ResolvedStockMovementSource {
  kind: StockMovementSourceKind;
  /** Display label for the table, e.g. "Sale". */
  label: string;
  /** Full source document id (CSV). */
  id: string;
  /** Short reference for the table cell. */
  reference: string;
  /** App route to the source document/list, or null when no detail route exists. */
  href: string | null;
}

const SHORT_REFERENCE_LENGTH = 8;

/** Priority when a row somehow carries more than one reference. */
export function resolveStockMovementSource(
  movement: StockMovementSourceIds,
): ResolvedStockMovementSource | null {
  if (movement.saleId) {
    return source('sale', 'Sale', movement.saleId, `/sales/${movement.saleId}`);
  }
  if (movement.purchaseOrderId) {
    return source(
      'purchase-order',
      'Purchase Order',
      movement.purchaseOrderId,
      `/suppliers/purchase-orders/${movement.purchaseOrderId}`,
    );
  }
  if (movement.stockTakeSessionId) {
    return source(
      'stock-take',
      'Stock Take',
      movement.stockTakeSessionId,
      `/stock-control/stock-takes/${movement.stockTakeSessionId}`,
    );
  }
  if (movement.batchId) {
    // There is no batch detail route. The batch list filters by variant, which
    // is the closest existing landing page for the referenced batch.
    return source(
      'batch',
      'Batch',
      movement.batchId,
      movement.variantId
        ? `/inventory/batches?variantId=${encodeURIComponent(movement.variantId)}`
        : '/inventory/batches',
    );
  }
  return null;
}

function source(
  kind: StockMovementSourceKind,
  label: string,
  id: string,
  href: string,
): ResolvedStockMovementSource {
  return {
    kind,
    label,
    id,
    reference: id.length > SHORT_REFERENCE_LENGTH ? id.slice(0, SHORT_REFERENCE_LENGTH) : id,
    href,
  };
}
