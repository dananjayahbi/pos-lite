/**
 * Production-history detail helpers (ARGUS #259).
 *
 * A production run's batch number is recorded in the PRODUCTION_LOGGED audit
 * after-payload (the ProductionLog row has no batch column), and its material
 * consumption is the frozen BOM recipe scaled by the produced quantity. Keeping
 * the extraction pure lets the list service and its tests share one rule.
 */
import { roundRawMaterialQuantity } from '@/lib/services/rawMaterial.core';

export interface ProductionRecipeItem {
  rawMaterialId: string;
  rawMaterialName: string;
  unit: string;
  quantityPerUnit: number | string;
}

export interface ProductionConsumptionRow extends ProductionRecipeItem {
  /** Total consumed for the run, at the shared four-decimal scale. */
  quantity: number;
}

/** Read `after.batchNumber` from a PRODUCTION_LOGGED audit payload. */
export function readProductionBatchNumber(after: unknown): string | null {
  if (typeof after !== 'object' || after === null) return null;
  const value = (after as Record<string, unknown>).batchNumber;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Scale each frozen recipe line by the produced quantity. Values are rounded to
 * four decimals (the raw-material quantity policy), never negative.
 */
export function scaleProductionConsumption(
  items: readonly ProductionRecipeItem[],
  producedQuantity: number,
): ProductionConsumptionRow[] {
  const produced = Number.isFinite(producedQuantity) && producedQuantity > 0 ? producedQuantity : 0;
  return items.map((item) => ({
    ...item,
    quantity: roundRawMaterialQuantity(
      roundRawMaterialQuantity(item.quantityPerUnit).times(produced),
    ).toNumber(),
  }));
}
