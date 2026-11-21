/**
 * Factory output KPIs (ARGUS #261).
 *
 * The dashboard only summarised raw-material input stock; units produced, run
 * count and finished-goods stock/value had to be assembled from the production
 * panel, the Batches module and the product pages. This pure summariser keeps
 * the server query and the KPI cards on one definition.
 */

export interface FinishedGoodsRow {
  stockQuantity: number;
  /** Cost of one finished unit. */
  costPrice: number;
}

export interface FactoryOutputStatsInput {
  productionRunCount: number;
  totalProduced: number;
  /** Raw-material value consumed across all runs. */
  totalMaterialCost: number;
  finishedGoods: readonly FinishedGoodsRow[];
}

export interface FactoryOutputStats {
  productionRunCount: number;
  totalProduced: number;
  totalMaterialCost: number;
  averageUnitsPerRun: number;
  finishedGoodsUnits: number;
  finishedGoodsValue: number;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Round money to the two-decimal scale used by the rest of the app. */
function money(value: number): number {
  return Math.round(nonNegative(value) * 100) / 100;
}

export function summarizeFactoryOutput(input: FactoryOutputStatsInput): FactoryOutputStats {
  const productionRunCount = Math.trunc(nonNegative(input.productionRunCount));
  const totalProduced = Math.trunc(nonNegative(input.totalProduced));

  let finishedGoodsUnits = 0;
  let finishedGoodsValue = 0;
  for (const row of input.finishedGoods) {
    const units = Math.trunc(nonNegative(row.stockQuantity));
    finishedGoodsUnits += units;
    finishedGoodsValue += units * nonNegative(row.costPrice);
  }

  return {
    productionRunCount,
    totalProduced,
    totalMaterialCost: money(input.totalMaterialCost),
    averageUnitsPerRun:
      productionRunCount > 0
        ? Math.round((totalProduced / productionRunCount) * 100) / 100
        : 0,
    finishedGoodsUnits,
    finishedGoodsValue: money(finishedGoodsValue),
  };
}
