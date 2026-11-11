import { z } from 'zod';

/**
 * Category and unit keys are tenant-defined strings. Built-in keys
 * (`OILS_LIQUIDS`, `LITERS`, ...) remain valid; custom keys are validated
 * against the tenant's catalog tables by the service layer.
 */
export const RawMaterialCategorySchema = z.string().trim().min(1, 'Category is required').max(80);
export const RawMaterialUnitSchema = z.string().trim().min(1, 'Unit is required').max(80);

const positiveDecimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a non-negative decimal number');

export const CreateRawMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: RawMaterialCategorySchema,
  unit: RawMaterialUnitSchema,
  quantity: positiveDecimal.default('0'),
  lowStockThreshold: positiveDecimal.default('0'),
  description: z.string().trim().max(500).optional(),
});

export const UpdateRawMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  category: RawMaterialCategorySchema.optional(),
  unit: RawMaterialUnitSchema.optional(),
  quantity: positiveDecimal.optional(),
  lowStockThreshold: positiveDecimal.optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const AdjustRawMaterialStockSchema = z.object({
  quantityDelta: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal number (can be negative)')
    .transform((value) => Number(value)),
});

export const CreateRawMaterialCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});

export const UpdateRawMaterialCategorySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: 'Nothing to update',
  });

export const CreateRawMaterialUnitSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  // Optional compact suffix shown next to quantities (e.g. "kg", "L").
  shortLabel: z.string().trim().min(1).max(20).optional(),
});

export const UpdateRawMaterialUnitSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    shortLabel: z.string().trim().min(1).max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.shortLabel !== undefined ||
      value.isActive !== undefined,
    { message: 'Nothing to update' },
  );

export type CreateRawMaterialInput = z.infer<typeof CreateRawMaterialSchema>;
export type UpdateRawMaterialInput = z.infer<typeof UpdateRawMaterialSchema>;
export type AdjustRawMaterialStockInput = z.infer<typeof AdjustRawMaterialStockSchema>;
export type CreateRawMaterialCategoryInput = z.infer<typeof CreateRawMaterialCategorySchema>;
export type UpdateRawMaterialCategoryInput = z.infer<typeof UpdateRawMaterialCategorySchema>;
export type CreateRawMaterialUnitInput = z.infer<typeof CreateRawMaterialUnitSchema>;
export type UpdateRawMaterialUnitInput = z.infer<typeof UpdateRawMaterialUnitSchema>;
