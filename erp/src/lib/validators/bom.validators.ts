import { z } from 'zod';
import {
  findDuplicateRawMaterialIds,
  INGREDIENT_DUPLICATE_MESSAGE,
} from '@/lib/services/bom.core';

const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a non-negative decimal number');

export const BomIngredientSchema = z.object({
  rawMaterialId: z.string().min(1, 'Raw material is required'),
  quantityPerUnit: positiveDecimalString.refine(
    (value) => Number(value) > 0,
    'Quantity per unit must be greater than zero',
  ),
});

/**
 * ARGUS #249 - reject the same raw material twice before it reaches the
 * `@@unique([bomId, rawMaterialId])` constraint (which surfaced as a 500).
 */
const BomIngredientsSchema = z
  .array(BomIngredientSchema)
  .min(1, 'At least one ingredient is required')
  .superRefine((ingredients, ctx) => {
    const duplicates = findDuplicateRawMaterialIds(ingredients);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: [ingredients.findIndex((i) => i.rawMaterialId === duplicates[0])],
        message: INGREDIENT_DUPLICATE_MESSAGE,
      });
    }
  });

export const CreateBomSchema = z.object({
  variantId: z.string().min(1, 'Finished product variant is required'),
  name: z.string().trim().min(1, 'Name is required').max(160),
  notes: z.string().trim().max(500).optional(),
  ingredients: BomIngredientsSchema,
});

export const UpdateBomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160).optional(),
  notes: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
  ingredients: BomIngredientsSchema.optional(),
});

export const ProduceGoodsSchema = z.object({
  bomId: z.string().min(1, 'BOM is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  note: z.string().trim().max(500).optional(),
});

export type CreateBomInput = z.infer<typeof CreateBomSchema>;
export type UpdateBomInput = z.infer<typeof UpdateBomSchema>;
export type ProduceGoodsInput = z.infer<typeof ProduceGoodsSchema>;
