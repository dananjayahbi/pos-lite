import { z } from 'zod';
import {
  GenderType,
  TaxRule,
  StockMovementReason,
} from '@/generated/prisma/client';

// ── Variant Schemas ──────────────────────────────────────────────────────────

export const CreateVariantInputSchema = z
  .object({
    size: z.string().max(10).optional(),
    colour: z.string().max(50).optional(),
    costPrice: z
      .number()
      .positive({ message: 'Cost price must be a positive number' }),
    retailPrice: z
      .number()
      .positive({ message: 'Retail price must be a positive number' }),
    wholesalePrice: z.number().positive().optional(),
    lowStockThreshold: z.number().int().min(0).default(5),
    barcode: z
      .string()
      .min(8)
      .max(20)
      .regex(
        /^[a-zA-Z0-9-]+$/,
        'Barcode must be 8-20 alphanumeric characters',
      )
      .optional(),
    sku: z.string().max(50).optional(),
    imageUrls: z.array(z.string().url()).max(5).default([]),
    initialStock: z.number().int().min(0).default(0),
  })
  .refine((data) => data.retailPrice >= data.costPrice, {
    message: 'Retail price must be greater than or equal to cost price',
    path: ['retailPrice'],
  })
  .refine(
    (data) => {
      if (data.wholesalePrice === undefined) return true;
      return (
        data.wholesalePrice >= data.costPrice &&
        data.wholesalePrice <= data.retailPrice
      );
    },
    {
      message:
        'Wholesale price must be between cost price and retail price',
      path: ['wholesalePrice'],
    },
  );

export const UpdateVariantSchema = z
  .object({
    sku: z.string().max(50).optional(),
    barcode: z
      .string()
      .min(8)
      .max(20)
      .regex(
        /^[a-zA-Z0-9-]+$/,
        'Barcode must be 8-20 alphanumeric characters',
      )
      .nullable()
      .optional(),
    size: z.string().min(1).max(20).nullable().optional(),
    colour: z.string().min(1).max(50).nullable().optional(),
    costPrice: z.number().positive().optional(),
    retailPrice: z.number().positive().optional(),
    wholesalePrice: z.number().positive().nullable().optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    imageUrls: z.array(z.string().url()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.costPrice !== undefined && data.retailPrice !== undefined) {
      if (data.retailPrice < data.costPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Retail price must be greater than or equal to cost price',
          path: ['retailPrice'],
        });
      }
    }
  });

// ── Product Schemas ──────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name: z
    .string()
    .min(2, 'Product name must be at least 2 characters')
    .max(120),
  description: z.string().max(1000).optional(),
  categoryId: z.string().cuid('A valid category ID is required'),
  brandId: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().cuid().optional()),
  gender: z.nativeEnum(GenderType),
  tags: z.array(z.string().max(30)).default([]),
  taxRule: z.nativeEnum(TaxRule).default('STANDARD_VAT'),
  variantDefinitions: z.array(CreateVariantInputSchema).optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

// ── Query Schema ─────────────────────────────────────────────────────────────

export const ProductListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  categories: z.string().optional(),
  brands: z.string().optional(),
  genders: z.string().optional(),
  status: z.enum(['active', 'archived', 'low_stock', 'out_of_stock']).optional(),
  gender: z.nativeEnum(GenderType).optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z
    .string()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .default('20')
    .transform(Number)
    .pipe(z.number().int().positive().max(1000)),
});

// ── Stock Adjustment Schema ──────────────────────────────────────────────────

export const StockAdjustmentSchema = z.object({
  variantId: z.string().cuid(),
  quantityDelta: z.number().int(),
  reason: z.nativeEnum(StockMovementReason),
  note: z.string().max(500).optional(),
});

// ── Inferred Types ───────────────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantInputSchema>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
