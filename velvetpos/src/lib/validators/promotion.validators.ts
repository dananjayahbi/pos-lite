import { z } from 'zod';

export const CreatePromotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['CART_PERCENTAGE', 'CART_FIXED', 'CATEGORY_PERCENTAGE', 'BOGO', 'MIX_AND_MATCH', 'PROMO_CODE']),
  value: z.number().min(0),
  promoCode: z.string().max(50).optional(),
  targetCategoryId: z.string().optional(),
  minQuantity: z.number().int().min(1).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

export const UpdatePromotionSchema = CreatePromotionSchema.partial();

export const EvaluateCartSchema = z.object({
  cartLines: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1),
    unitPrice: z.string().min(1),
    manualDiscountAmount: z.string().optional(),
    categoryId: z.string().optional(),
  })).min(1),
  customerId: z.string().optional(),
  promoCode: z.string().optional(),
});

export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;
export type EvaluateCartInput = z.infer<typeof EvaluateCartSchema>;
