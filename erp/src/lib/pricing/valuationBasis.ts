/**
 * ARGUS #218 - state the stock-valuation cost basis explicitly.
 *
 * The ERP computes cost value as `ProductVariant.costPrice * stockQuantity` at
 * the moment the report runs. That is a current-cost snapshot, not the actual
 * acquisition cost of the units on hand. The data model has no per-unit
 * inventory-cost layer (SaleLine keeps a cost snapshot for COGS, and purchase
 * lines keep receipt costs, but neither reconstructs remaining stock value), so
 * the report cannot honestly present an acquisition-cost figure without a
 * schema/inventory-layer change.
 *
 * These labels are shared by the page, KPI card and CSV.
 */

export const VALUATION_COST_BASIS = 'current-cost' as const;
export type ValuationCostBasis = typeof VALUATION_COST_BASIS;

export const VALUATION_COST_BASIS_LABEL = 'At current cost';
export const VALUATION_COST_BASIS_NOTE =
  'Current cost price x stock on hand. Not historical acquisition cost.';

export function valuationCostBasisLabel(): string {
  return VALUATION_COST_BASIS_LABEL;
}

export function valuationCostBasisNote(): string {
  return VALUATION_COST_BASIS_NOTE;
}
