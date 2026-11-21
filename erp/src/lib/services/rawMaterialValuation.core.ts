/**
 * Raw-material valuation (ARGUS #243).
 *
 * Raw materials were a quantity-only counter. A unit cost makes stock value and
 * the material cost of a production run explicit, so they can be included in
 * inventory valuation and finished-goods COGS.
 */

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Value of the quantity on hand at the recorded unit cost. */
export function computeRawMaterialStockValue(quantity: number, unitCost: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return 0;
  return roundMoney(Math.max(0, quantity) * Math.max(0, unitCost));
}

export interface MaterialConsumption {
  unitCost: number;
  required: number;
}

/** Value of the raw materials consumed by one production run. */
export function computeMaterialCost(consumption: MaterialConsumption[]): number {
  return roundMoney(
    consumption.reduce(
      (sum, line) => sum + Math.max(0, line.required) * Math.max(0, line.unitCost),
      0,
    ),
  );
}
