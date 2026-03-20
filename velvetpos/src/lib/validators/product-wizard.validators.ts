import { z } from 'zod';
import { GenderType, TaxRule } from '@/generated/prisma/client';

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
  gender: z.nativeEnum(GenderType, {
    error: 'Please select a gender',
  }),
  tags: z.array(z.string()).max(20, 'Maximum 20 tags'),
  taxRule: z.nativeEnum(TaxRule),
});

export type ProductStep1FormData = z.infer<typeof productStep1Schema>;
