import { z } from 'zod';
import { TAX_RULES } from '@/lib/constants/product-options';

/**
 * Wizard step 1 schema — basic product info.
 *
 * Note: "gender" was removed (clothing-only concept). Ayurveda products are
 * not gendered; use `tags[]` for "kids", "women's wellness" etc. if needed.
 * The per-variant `form` and `packSize` are set in step 2.
 */
export const productStep1Schema = z.object({
  name: z
    .string()
    .min(2, 'Product name must be at least 2 characters')
    .max(120, 'Product name must be at most 120 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
  categoryId: z.string().min(1, 'Category is required'),
  brandId: z.string().optional(),
  tags: z.array(z.string()).max(20, 'Maximum 20 tags'),
  taxRule: z.enum(TAX_RULES),
});

export type ProductStep1FormData = z.infer<typeof productStep1Schema>;