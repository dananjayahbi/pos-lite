import { z } from 'zod';
import { TAX_RULES } from '@/lib/constants/product-options';
import { PRODUCT_SOURCES } from '@/lib/constants/product-options';
import { HEALTH_CONCERNS } from '@/lib/constants/health-concerns';

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
  mainImageUrl: z.string().max(500).optional(),
  activeIngredients: z.string().max(5000).optional(),
  usageInstructions: z.string().max(5000).optional(),
  healthBenefits: z.string().max(5000).optional(),
  safetyPrecautions: z.string().max(5000).optional(),
  healthConcerns: z.array(z.enum(HEALTH_CONCERNS)).default([]),
  productSource: z.enum(PRODUCT_SOURCES).default('MANUFACTURED'),
});

export type ProductStep1FormData = z.infer<typeof productStep1Schema>;