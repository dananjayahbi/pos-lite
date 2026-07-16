import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0).optional(),
});

export const UpdateCategorySchema = CategorySchema.partial();

export type CategoryInput = z.infer<typeof CategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
