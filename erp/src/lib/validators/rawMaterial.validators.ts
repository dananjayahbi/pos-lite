import { z } from 'zod';
import type { RawMaterialCategory, Unit } from '@/generated/prisma/client';
import { RAW_MATERIAL_CATEGORIES, UNITS } from '@/lib/services/rawMaterial.core';

export const RawMaterialCategorySchema = z.enum(
  RAW_MATERIAL_CATEGORIES as [RawMaterialCategory, ...RawMaterialCategory[]],
);
export const RawMaterialUnitSchema = z.enum(UNITS as [Unit, ...Unit[]]);

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

export type CreateRawMaterialInput = z.infer<typeof CreateRawMaterialSchema>;
export type UpdateRawMaterialInput = z.infer<typeof UpdateRawMaterialSchema>;
export type AdjustRawMaterialStockInput = z.infer<typeof AdjustRawMaterialStockSchema>;
