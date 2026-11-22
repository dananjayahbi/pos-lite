/**
 * Bill of Materials core — pure, framework-free helpers for BOM math and
 * production-consumption validation.
 *
 * Kept free of Prisma/DB so it can be unit-tested in isolation and reused by
 * the service layer, validators, and UI.
 */
import Decimal from 'decimal.js';
import type { BillOfMaterialsItem, RawMaterial } from '@/generated/prisma/client';
import {
  RAW_MATERIAL_QUANTITY_ROUNDING,
  RAW_MATERIAL_QUANTITY_SCALE,
  roundRawMaterialQuantity,
} from '@/lib/services/rawMaterial.core';

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
  // ARGUS #245: Decimal multiplication at the shared quantity scale, so
  // 0.1 x 3 stores 0.3 rather than 0.30000000000000004.
  return new Decimal(quantityPerUnit.toString())
    .times(unitsToProduce)
    .toDecimalPlaces(RAW_MATERIAL_QUANTITY_SCALE, RAW_MATERIAL_QUANTITY_ROUNDING)
    .toNumber();
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
      // Decimal comparison at the shared scale, not raw JS floats.
      insufficient: roundRawMaterialQuantity(required).greaterThan(
        roundRawMaterialQuantity(ingredient.available),
      ),
    };
  });
}

/** Returns `true` when any ingredient in the plan is short for the run. */
export function hasInsufficientIngredients(plan: ConsumptionLine[]): boolean {
  return plan.some((line) => line.insufficient);
}

/**
 * ARGUS #249 - the same raw material must not appear on two ingredient rows.
 *
 * The database enforces this with `@@unique([bomId, rawMaterialId])`, but a
 * duplicate submitted through the form used to reach that constraint and
 * surface as an unmapped P2002 500. This helper is shared by the Zod schema,
 * the service and the form so every layer rejects it with the same message.
 *
 * Blank ids (empty form rows) are ignored; they are rejected separately by the
 * required-field validation.
 */
export const INGREDIENT_DUPLICATE_MESSAGE =
  'Ingredient already added - each raw material can appear only once.';

/** Ids that occur more than once, in first-duplicate order. */
export function findDuplicateRawMaterialIds(
  ingredients: readonly { rawMaterialId: string }[],
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const ingredient of ingredients) {
    const id = ingredient.rawMaterialId;
    if (!id) continue;
    if (seen.has(id)) {
      if (!duplicates.includes(id)) duplicates.push(id);
      continue;
    }
    seen.add(id);
  }
  return duplicates;
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

/**
 * ARGUS #250 - the New BOM picker offered every variant, including traded goods
 * and variants that already own a BOM, so Save failed with 409/422 after the
 * operator had filled in the ingredients.
 */
export type BomVariantIneligibilityReason = 'NOT_MANUFACTURED' | 'BOM_EXISTS';

export interface BomVariantEligibilityInput {
  productSource: ProductSourceValue;
  /** True when a BOM row exists for the variant (including a soft-deleted one). */
  hasExistingBom: boolean;
}

/** The reason this variant cannot receive a new BOM, or null when eligible. */
export function bomVariantIneligibilityReason(
  input: BomVariantEligibilityInput,
): BomVariantIneligibilityReason | null {
  if (!isSourceEligibleForProduction(input.productSource)) return 'NOT_MANUFACTURED';
  if (input.hasExistingBom) return 'BOM_EXISTS';
  return null;
}

/** True when the variant may be offered in the New BOM picker. */
export function isVariantEligibleForBom(input: BomVariantEligibilityInput): boolean {
  return bomVariantIneligibilityReason(input) === null;
}

/**
 * What a create-BOM request should do when a unique `[tenantId, variantId]`
 * row already exists. A live row is a real conflict; a soft-deleted one can be
 * revived so the variant is not permanently stuck without a recipe (ARGUS
 * proposal: soft-deleted BOM restore).
 */
export type BomCreateDecision = 'create' | 'revive' | 'exists';

export function bomCreateDecision(
  existing: { deletedAt: Date | null } | null | undefined,
): BomCreateDecision {
  if (!existing) return 'create';
  return existing.deletedAt ? 'revive' : 'exists';
}

/**
 * ARGUS #248 - a BOM is immutable once production has used it.
 *
 * Editing the ingredient rows after a run would rewrite the recipe behind
 * every past production log, and a soft delete would leave those runs without
 * a viewable recipe. Both operations are refused from the first logged run.
 */
export const BOM_LOCKED_MESSAGE =
  'This bill of materials has production runs recorded, so its recipe can no longer be edited or deleted.';

/** True while a BOM has never been used in production (and may be changed). */
export function canModifyBom(productionLogCount: number): boolean {
  if (!Number.isFinite(productionLogCount)) return false;
  return productionLogCount <= 0;
}

/**
 * ARGUS #251 - activating/deactivating a recipe is not a recipe edit.
 *
 * The update service refused every PATCH once a production run existed, which
 * also blocked the `isActive` toggle the API and table now expose. Retiring a
 * recipe must stay possible (it only stops future production), while ingredient,
 * name and note changes remain refused because they would rewrite history.
 */
export function bomUpdateChangesRecipe(input: {
  name?: unknown;
  notes?: unknown;
  ingredients?: unknown;
}): boolean {
  return (
    input.name !== undefined ||
    input.notes !== undefined ||
    input.ingredients !== undefined
  );
}

/**
 * Build a deterministic, human-readable batch number for a production run.
 *
 * Example: `MFG-20261101-8FK2M1QZ`. The suffix comes from the production-log
 * id so repeated runs of the same product never collide.
 */
export function buildProductionBatchNumber(seed: string, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix =
    seed
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8)
      .toUpperCase() || 'BATCH';
  return `MFG-${day}-${suffix}`;
}
