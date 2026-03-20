import { z } from 'zod';

export const BrandSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url('Logo URL must be a valid URL').nullable().optional(),
});

export const UpdateBrandSchema = BrandSchema.partial();

export type BrandInput = z.infer<typeof BrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
