import { z } from 'zod';
import { PaymentMethod } from '@/generated/prisma/client';

const CreateSaleLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.int().min(1),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const CreateSaleSchema = z.object({
  shiftId: z.string().min(1),
  lines: z.array(CreateSaleLineSchema).min(1),
  cartDiscountAmount: z.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod, { error: 'Invalid payment method' }),
  authorizingManagerId: z.string().min(1).optional(),
  cashReceived: z.number().positive().optional(),
  cardReferenceNumber: z.string().max(20).optional(),
  cardAmount: z.number().positive().optional(),
  customerId: z.string().min(1).optional(),
  appliedStoreCredit: z.string().optional().default('0'),
  appliedPromotions: z.any().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'CASH') {
    if (data.cashReceived === undefined || data.cashReceived <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['cashReceived'],
        message: 'cashReceived is required for CASH payments',
      });
    }
  }
  if (data.paymentMethod === 'SPLIT') {
    if (data.cardAmount === undefined || data.cardAmount <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['cardAmount'],
        message: 'cardAmount is required for SPLIT payments',
      });
    }
    if (data.cashReceived === undefined || data.cashReceived <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['cashReceived'],
        message: 'cashReceived is required for SPLIT payments',
      });
    }
  }
});

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;

// ── Hold Sale ────────────────────────────────────────────────────────────────

const HoldSaleLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.int().min(1),
  discountPercent: z.number().min(0).max(100).default(0),
  productNameSnapshot: z.string().min(1),
  variantDescriptionSnapshot: z.string().min(1),
  sku: z.string().min(1),
  unitPrice: z.number().min(0),
});

export const HoldSaleSchema = z.object({
  shiftId: z.string().min(1),
  lines: z.array(HoldSaleLineSchema).min(1),
  cartDiscountAmount: z.number().min(0).default(0),
  cartDiscountPercent: z.number().min(0).max(100).default(0),
});

export type HoldSaleInput = z.infer<typeof HoldSaleSchema>;
