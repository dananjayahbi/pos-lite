import { z } from 'zod';
import { GENDER_TYPES, TAX_RULES } from '@/lib/constants/product-options';

export const productStep1Schema = z.object({
  name: z
    .string()
    .min(2, 'Product name must be at least 2 characters')
    .max(120, 'Product name must be at most 120 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  brandId: z.string(),
  gender: z.enum(GENDER_TYPES, {
    error: 'Please select a gender',
  }),
  tags: z.array(z.string()).max(20, 'Maximum 20 tags'),
  taxRule: z.enum(TAX_RULES),
});

export type ProductStep1FormData = z.infer<typeof productStep1Schema>;
