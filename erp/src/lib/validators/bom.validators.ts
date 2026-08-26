import { z } from 'zod';

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

export const CreateBomSchema = z.object({
  variantId: z.string().min(1, 'Finished product variant is required'),
  name: z.string().trim().min(1, 'Name is required').max(160),
  notes: z.string().trim().max(500).optional(),
  ingredients: z
    .array(BomIngredientSchema)
    .min(1, 'At least one ingredient is required'),
});

export const UpdateBomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160).optional(),
  notes: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
  ingredients: z.array(BomIngredientSchema).min(1, 'At least one ingredient is required').optional(),
});

export const ProduceGoodsSchema = z.object({
  bomId: z.string().min(1, 'BOM is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  note: z.string().trim().max(500).optional(),
});

export type CreateBomInput = z.infer<typeof CreateBomSchema>;
export type UpdateBomInput = z.infer<typeof UpdateBomSchema>;
export type ProduceGoodsInput = z.infer<typeof ProduceGoodsSchema>;
