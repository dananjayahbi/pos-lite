import { z } from 'zod';

export const variantEditSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  barcode: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[a-zA-Z0-9-]+$/, 'Barcode must be alphanumeric')
    .nullable()
    .optional(),
  size: z.string().min(1, 'Size is required').max(10),
  colour: z.string().min(1, 'Colour is required').max(50),
  costPrice: z.number().positive('Cost price must be positive'),
  retailPrice: z.number().positive('Retail price must be positive'),
  wholesalePrice: z.number().positive().nullable().optional(),
  lowStockThreshold: z.number().int().min(0, 'Must be 0 or greater'),
  imageUrls: z.array(z.string()).optional(),
});

export type VariantEditFormData = z.infer<typeof variantEditSchema>;
