import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().min(2).max(60),
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
  sortOrder: z.number().int().nonnegative().default(0).optional(),
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
