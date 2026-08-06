import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
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
