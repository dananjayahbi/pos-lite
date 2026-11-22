import { z } from 'zod';

export const BrandSchema = z.object({
  name: z.string().min(2).max(60),
  // An empty or whitespace-only description clears the stored text (ARGUS #174);
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
  logoUrl: z.string().url('Logo URL must be a valid URL').nullable().optional(),
});

export const UpdateBrandSchema = BrandSchema.partial();

export type BrandInput = z.infer<typeof BrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
