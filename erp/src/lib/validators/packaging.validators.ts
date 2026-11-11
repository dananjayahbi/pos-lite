import { z } from 'zod';

// Enum values mirrored from the Prisma schema. Keep in sync with
// `schema.prisma` enums `PackagingCategory` and `PackagingUnit`. Defined
// locally (not imported from the Prisma client) so this validator stays
// bundle-safe for client components — the Prisma client requires Node
// built-ins (`node:module`) and cannot run in the browser.
export const PACKAGING_CATEGORIES = [
  'POLYMAILER',
  'TAPE',
  'LABEL',
  'BUBBLE_WRAP',
  'OTHER',
] as const;

export const PACKAGING_UNITS = ['PIECE', 'ROLL', 'BOX', 'METER'] as const;

export type PackagingCategory = (typeof PACKAGING_CATEGORIES)[number];
export type PackagingUnit = (typeof PACKAGING_UNITS)[number];

/**
 * Category keys are tenant-defined once the customer adds their own
 * categories, so items validate against a key string — not the closed enum.
 * The service asserts the key exists for the tenant.
 */
export const PackagingCategorySchema = z
  .string()
  .trim()
  .min(1, 'Category is required')
  .max(80, 'Category is too long');

export const CreatePackagingItemSchema = z.object({
  category: PackagingCategorySchema.default('OTHER'),
  name: z.string().min(1, 'Name is required').max(120),
  sku: z.string().max(60).optional().or(z.literal('')),
  /** Let the API derive a unique SKU from the category + name. */
  autoGenerateSku: z.boolean().default(false),
  unit: z.enum(PACKAGING_UNITS).default('PIECE'),
  quantityOnHand: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  autoDeduct: z.boolean().default(false),
  consumptionPerParcel: z.coerce.number().nonnegative().optional(),
});

// `autoGenerateSku` is create-only; PATCH never regenerates an existing SKU.
// Declared explicitly (not `Create…partial()`) so create-time `.default()`
// values cannot leak into a PATCH and silently reset untouched fields.
export const UpdatePackagingItemSchema = z.object({
  category: PackagingCategorySchema.optional(),
  name: z.string().min(1, 'Name is required').max(120).optional(),
  sku: z.string().max(60).optional().or(z.literal('')),
  unit: z.enum(PACKAGING_UNITS).optional(),
  quantityOnHand: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  autoDeduct: z.boolean().optional(),
  // `null` clears the per-parcel rate.
  consumptionPerParcel: z.coerce.number().nonnegative().nullable().optional(),
});

export const PackagingStockAdjustSchema = z.object({
  delta: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta cannot be zero'),
  note: z.string().max(500).optional(),
});

export const CreatePackagingCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});

export const UpdatePackagingCategorySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: 'Nothing to update',
  });

export type CreatePackagingItemInput = z.infer<typeof CreatePackagingItemSchema>;
export type UpdatePackagingItemInput = z.infer<typeof UpdatePackagingItemSchema>;
export type PackagingStockAdjustInput = z.infer<typeof PackagingStockAdjustSchema>;
export type CreatePackagingCategoryInput = z.infer<typeof CreatePackagingCategorySchema>;
export type UpdatePackagingCategoryInput = z.infer<typeof UpdatePackagingCategorySchema>;
