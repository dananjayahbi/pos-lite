import { z } from 'zod';
import { ReturnRefundMethod } from '@/generated/prisma/client';

const ReturnLineSchema = z.object({
  saleLineId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.int().min(1),
});

export const ReturnCreateSchema = z.object({
  originalSaleId: z.string().min(1),
  lines: z.array(ReturnLineSchema).min(1),
  refundMethod: z.nativeEnum(ReturnRefundMethod, { error: 'Invalid refund method' }),
  restockItems: z.boolean().default(true),
  reason: z.string().max(200).default(''),
  authorizedById: z.string().min(1),
  cardReversalReference: z.string().max(50).optional(),
}).superRefine((data, ctx) => {
  if (data.refundMethod === ReturnRefundMethod.CARD_REVERSAL) {
    if (!data.cardReversalReference || data.cardReversalReference.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['cardReversalReference'],
        message: 'Reversal reference number is required for card reversals',
      });
    }
  }
});

export type ReturnCreateInput = z.infer<typeof ReturnCreateSchema>;
