import { z } from 'zod';

import { CATEGORY_SORT_ORDER_MAX } from '@/lib/categories/categoryForm.core';

export const CategorySchema = z.object({
  // ARGUS #173: trim first so "  Oils  " is stored and compared as "Oils".
  name: z.string().trim().min(2).max(60),
  // An empty or whitespace-only description clears the stored text (ARGUS #166);
  // `null` is the canonical "no description" value the PATCH writes.
  description: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    }),
  sortOrder: z.number().int().nonnegative().max(CATEGORY_SORT_ORDER_MAX).default(0).optional(),
  imageUrl: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val === '' ? null : val))
    .pipe(z.string().max(500).nullable().optional()),
});

export const UpdateCategorySchema = CategorySchema.partial();

export type CategoryInput = z.infer<typeof CategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
