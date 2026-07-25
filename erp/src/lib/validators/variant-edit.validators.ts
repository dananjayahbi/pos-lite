import { z } from 'zod';

/**
 * Variant edit form schema.
 *
 * Replaces clothing `size` (required) and `colour` (required) with ayurveda
 * `packSize` (optional free text) and `form` (optional free text). Both are
 * optional since some ayurveda products are one-form/one-pack products
 * (e.g. a single 100ml oil bottle).
 */
export const variantEditSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  barcode: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[a-zA-Z0-9-]+$/, 'Barcode must be alphanumeric')
    .nullable()
    .optional(),
  form: z.string().max(30).nullable().optional(),
  packSize: z.string().max(20).nullable().optional(),
  costPrice: z.number().positive('Cost price must be positive'),
  retailPrice: z.number().positive('Retail price must be positive'),
  wholesalePrice: z.number().positive().nullable().optional(),
  lowStockThreshold: z.number().int().min(0, 'Must be 0 or greater'),
  imageUrls: z.array(z.string()).optional(),
});

export type VariantEditFormData = z.infer<typeof variantEditSchema>;