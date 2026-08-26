import { z } from 'zod';

import { LABEL_HEADER_LAYOUTS, LABEL_PAGE_SIZES } from '@/lib/constants/label';

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Must be a 6-digit hex color, e.g. #3A2D28');

/**
 * Shipping-label template schema. Uses local const arrays for the enums so this
 * module stays safe to import from client components (no Prisma client import).
 */
export const LabelTemplateSchema = z.object({
  brandName: z.string().max(60),
  logoUrl: z.string().url().or(z.literal('')).nullable(),
  accentColor: hexColor,
  borderColor: hexColor,
  headerLayout: z.enum([...LABEL_HEADER_LAYOUTS]),
  pageSize: z.enum([...LABEL_PAGE_SIZES]),
  showBarcodes: z.boolean(),
  showOrderRef: z.boolean(),
  showCod: z.boolean(),
  showItemCount: z.boolean(),
  showWeight: z.boolean(),
  showOrigin: z.boolean(),
  showPickupAddress: z.boolean(),
  footerNote: z.string().max(120),
});

export type LabelTemplateInput = z.infer<typeof LabelTemplateSchema>;
