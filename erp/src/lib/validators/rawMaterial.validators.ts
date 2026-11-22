import { z } from 'zod';
import { RAW_MATERIAL_ADJUSTMENT_REASONS } from '@/lib/services/rawMaterialAdjustment.core';
import { hasAlphanumeric } from '@/lib/units/unitValidation.core';

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
  // Cost of one base unit; drives raw-material valuation and production COGS.
  unitCost: positiveDecimal.default('0'),
  description: z.string().trim().max(500).optional(),
});

export const UpdateRawMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  category: RawMaterialCategorySchema.optional(),
  unit: RawMaterialUnitSchema.optional(),
  // ARGUS #241: quantity is not editable — stock moves through the adjustment
  // endpoint (delta + reason + audit), never through an absolute overwrite.
  lowStockThreshold: positiveDecimal.optional(),
  // Cost per base unit. Not a stock movement, so it stays editable (ARGUS #243).
  unitCost: positiveDecimal.optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const AdjustRawMaterialStockSchema = z.object({
  // Keep the operator's decimal string: the service does the arithmetic in
  // Decimal and the shared four-decimal scale, never in JS floats (ARGUS #245).
  quantityDelta: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal number (can be negative)'),
  // ARGUS #246: a fixed reason is mandatory. Free text made the adjustment
  // history unusable and was never required server-side.
  reason: z.enum(RAW_MATERIAL_ADJUSTMENT_REASONS),
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

// ARGUS #482: a unit name with no letters/digits used to collapse to the hidden
// "CATEGORY" key, so the API rejects it explicitly.
const rawMaterialUnitName = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80)
  .refine(hasAlphanumeric, {
    message: 'Unit name must include at least one letter or number',
  });

export const CreateRawMaterialUnitSchema = z.object({
  name: rawMaterialUnitName,
  // Optional compact suffix shown next to quantities (e.g. "kg", "L").
  shortLabel: z.string().trim().min(1).max(20).optional(),
});

export const UpdateRawMaterialUnitSchema = z
  .object({
    name: rawMaterialUnitName.optional(),
    // ARGUS #486: `null` means "clear and derive from the name" instead of the
    // old silent no-op where omitting the field kept the stale label.
    shortLabel: z.string().trim().min(1).max(20).nullable().optional(),
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
