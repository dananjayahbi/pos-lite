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
  // Optional by design (ARGUS #95): the route fills in the signed-in
  // manager/owner. A non-manager holding an explicit `sale:refund` override
  // may legitimately refund without an authorizer, so the schema must accept
  // its absence; those rows render as "Not recorded".
  authorizedById: z.string().min(1).optional(),
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
