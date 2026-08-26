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

export const CreatePackagingItemSchema = z.object({
  category: z.enum(PACKAGING_CATEGORIES).default('OTHER'),
  name: z.string().min(1, 'Name is required').max(120),
  sku: z.string().max(60).optional().or(z.literal('')),
  unit: z.enum(PACKAGING_UNITS).default('PIECE'),
  quantityOnHand: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  autoDeduct: z.boolean().default(false),
  consumptionPerParcel: z.coerce.number().nonnegative().optional(),
});

export const UpdatePackagingItemSchema = CreatePackagingItemSchema.partial();

export const PackagingStockAdjustSchema = z.object({
  delta: z.coerce.number().int().refine((v) => v !== 0, 'Delta cannot be zero'),
  note: z.string().max(500).optional(),
});

export type CreatePackagingItemInput = z.infer<typeof CreatePackagingItemSchema>;
export type UpdatePackagingItemInput = z.infer<typeof UpdatePackagingItemSchema>;
export type PackagingStockAdjustInput = z.infer<typeof PackagingStockAdjustSchema>;
