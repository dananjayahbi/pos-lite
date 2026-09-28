import { z } from 'zod';
import { HealthConcern, TaxRule, StockMovementReason, ProductSource } from '@/generated/prisma/client';

// ── Variant Schemas ──────────────────────────────────────────────────────────

/**
 * Create-variant input — replaces clothing `size` and `colour` with ayurveda
 * `packSize` (free text like "100g", "60 caps") and `form` (POWDER, OIL, etc.).
 */
export const CreateVariantInputSchema = z
  .object({
    form: z
      .string()
      .max(30, 'Form must be at most 30 characters')
      .optional(),
    packSize: z
      .string()
      .max(20, 'Pack size must be at most 20 characters')
      .optional(),
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
    imageUrls: z.array(z.string().url()).max(10).default([]),
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

/**
 * Update-variant schema — same shape as Create but every field optional.
 */
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
    form: z.string().max(30).nullable().optional(),
    packSize: z.string().max(20).nullable().optional(),
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

/**
 * Create-product schema. `gender` removed (clothing-only).
 *
 * BUG-19 (M02-02): the top-level object is `.strict()` — unknown keys are no
 * longer silently stripped (a client posting `variants:[…]` used to get a 201
 * with ZERO variants). `variants` is kept working as an explicit alias of
 * `variantDefinitions` via `normalizeVariantsAlias` below.
 */
const CreateProductObject = z
  .object({
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
    tags: z.array(z.string().max(30)).default([]),
    taxRule: z.nativeEnum(TaxRule).default('STANDARD_VAT'),
    // Single representative image for storefront product cards.
    mainImageUrl: z
      .string()
      .max(500)
      .optional()
      .transform((val) => (val === '' ? null : val))
      .pipe(z.string().max(500).nullable().optional()),
    // Ayurvedic health/usage content — structured storefront sections.
    activeIngredients: z.string().max(5000).nullable().optional(),
    usageInstructions: z.string().max(5000).nullable().optional(),
    healthBenefits: z.string().max(5000).nullable().optional(),
    safetyPrecautions: z.string().max(5000).nullable().optional(),
    healthConcerns: z.array(z.nativeEnum(HealthConcern)).default([]),
    productSource: z.nativeEnum(ProductSource).default(ProductSource.MANUFACTURED),
    variantDefinitions: z.array(CreateVariantInputSchema).optional(),
  })
  .strict();

/**
 * BUG-19: `variants` is accepted as an explicit alias of
 * `variantDefinitions` (mapped before parsing). If both keys are present,
 * `variantDefinitions` wins and the alias key is dropped so `.strict()` does
 * not reject it. Every OTHER unknown top-level key fails with
 * unrecognized_keys → 400 VALIDATION_ERROR at the route.
 */
function normalizeVariantsAlias(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'variants' in value) {
    const { variants, ...rest } = value as Record<string, unknown>;
    if (rest.variantDefinitions === undefined) {
      return { ...rest, variantDefinitions: variants };
    }
    return rest;
  }
  return value;
}

export const CreateProductSchema = z.preprocess(normalizeVariantsAlias, CreateProductObject);

// PATCH stays lenient (explicit `.strip()` undoes `.strict()` inherited from
// `CreateProductObject`): M02-02 scopes the strictness flip to the create
// surface only, so existing PATCH callers are unaffected.
export const UpdateProductSchema = CreateProductObject.partial()
  .extend({
    isArchived: z.boolean().optional(),
  })
  .strip();

// ── Query Schema ─────────────────────────────────────────────────────────────

export const ProductListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  categories: z.string().optional(),
  brands: z.string().optional(),
  status: z.enum(['active', 'archived', 'low_stock', 'out_of_stock']).optional(),
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

/**
 * M09-02/M09-03 — business ceiling on a single adjustment delta: ±1,000,000
 * units. `stockQuantity` lives in a Postgres int4 column; an uncapped delta
 * used to overflow it into an unhandled 500 (BUG-41). 1M units is already
 * absurd for a POS line item and keeps `stockQuantity + delta` comfortably
 * inside int4 even after repeated adds, so absurd values fail validation
 * before touching the DB. The documented ceiling is this constant.
 */
export const MAX_STOCK_ADJUSTMENT_DELTA = 1_000_000;

/** PostgreSQL int4 ceiling — the hard storage limit for `stockQuantity`. */
export const MAX_STOCK_QUANTITY = 2_147_483_647;

export const StockAdjustmentSchema = z.object({
  variantId: z.string().cuid(),
  quantityDelta: z
    .number()
    .int()
    // M09-03 (OBS-19): parity with the bulk-adjust schema — a 0-delta
    // adjustment is a silent no-op that still writes a noise row into the
    // immutable ledger, so reject it up front.
    .refine((v) => v !== 0, { message: 'quantityDelta cannot be zero' })
    // M09-02 (BUG-41): bound the raw delta so the int4 overflow can never
    // reach the DB (the route keeps a newQty guard as defense in depth).
    .refine((v) => Math.abs(v) <= MAX_STOCK_ADJUSTMENT_DELTA, {
      message: `quantityDelta must be between -${MAX_STOCK_ADJUSTMENT_DELTA} and ${MAX_STOCK_ADJUSTMENT_DELTA}`,
    }),
  reason: z.nativeEnum(StockMovementReason),
  note: z.string().max(500).optional(),
});

// ── Inferred Types ───────────────────────────────────────────────────────────

export type CreateProductInput = z.output<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantInputSchema>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;