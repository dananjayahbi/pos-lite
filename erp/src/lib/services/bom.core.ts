/**
 * Bill of Materials core — pure, framework-free helpers for BOM math and
 * production-consumption validation.
 *
 * Kept free of Prisma/DB so it can be unit-tested in isolation and reused by
 * the service layer, validators, and UI.
 */
import type { BillOfMaterialsItem, RawMaterial } from '@/generated/prisma/client';

/** A raw material ingredient line needed by a BOM (Decimal → number). */
export interface BomIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  unit: RawMaterial['unit'];
  /** Quantity of the raw material consumed per ONE finished good. */
  quantityPerUnit: number;
  /** Current on-hand quantity of the raw material. */
  available: number;
}

/**
 * Compute the total quantity required of a single ingredient to produce a given
 * number of finished goods.
 */
export function computeIngredientRequirement(
  quantityPerUnit: number,
  unitsToProduce: number,
): number {
  if (!Number.isFinite(quantityPerUnit) || quantityPerUnit < 0) {
    throw new Error('quantityPerUnit must be a non-negative finite number');
  }
  if (!Number.isInteger(unitsToProduce) || unitsToProduce <= 0) {
    throw new Error('unitsToProduce must be a positive integer');
  }
  return quantityPerUnit * unitsToProduce;
}

export interface ConsumptionLine {
  rawMaterialId: string;
  rawMaterialName: string;
  quantityPerUnit: number;
  required: number;
  available: number;
  unit: RawMaterial['unit'];
  /** True when `required` exceeds `available`. */
  insufficient: boolean;
}

/**
 * Compute the full consumption plan for a production run, marking any
 * ingredient that would fall below zero as insufficient.
 */
export function computeConsumptionPlan(
  ingredients: BomIngredient[],
  unitsToProduce: number,
): ConsumptionLine[] {
  return ingredients.map((ingredient) => {
    const required = computeIngredientRequirement(
      ingredient.quantityPerUnit,
      unitsToProduce,
    );
    return {
      rawMaterialId: ingredient.rawMaterialId,
      rawMaterialName: ingredient.rawMaterialName,
      quantityPerUnit: ingredient.quantityPerUnit,
      required,
      available: ingredient.available,
      unit: ingredient.unit,
      insufficient: required > ingredient.available,
    };
  });
}

/** Returns `true` when any ingredient in the plan is short for the run. */
export function hasInsufficientIngredients(plan: ConsumptionLine[]): boolean {
  return plan.some((line) => line.insufficient);
}

/**
 * Pick only the insufficient lines, sorted by shortfall (largest gap first).
 * Used for helpful error messages / UI surfacing before commit.
 */
export function getInsufficientIngredients(plan: ConsumptionLine[]): ConsumptionLine[] {
  return plan
    .filter((line) => line.insufficient)
    .sort((a, b) => (b.required - b.available) - (a.required - a.available));
}

/** Convert a Prisma BOM item row + its raw material into a core ingredient. */
export function toBomIngredient(
  item: Pick<BillOfMaterialsItem, 'id' | 'rawMaterialId' | 'quantityPerUnit'> & {
    rawMaterial?: Pick<
      RawMaterial,
      'id' | 'name' | 'unit' | 'quantity'
    > | null;
  },
): BomIngredient {
  return {
    rawMaterialId: item.rawMaterialId,
    rawMaterialName: item.rawMaterial?.name ?? 'Unknown material',
    unit: item.rawMaterial?.unit ?? 'KILOGRAMS',
    quantityPerUnit: item.quantityPerUnit.toNumber(),
    available: item.rawMaterial ? item.rawMaterial.quantity.toNumber() : 0,
  };
}

/** Product source type for the production-eligibility gate. */
export type ProductSourceValue = 'MANUFACTURED' | 'TRADED';

/**
 * Only in-house manufactured goods are eligible for BOM assignment and
 * production logging; traded/resold goods must skip production entirely.
 */
export function isSourceEligibleForProduction(source: ProductSourceValue): boolean {
  return source === 'MANUFACTURED';
}
