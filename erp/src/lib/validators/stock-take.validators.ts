import { z } from 'zod';

/**
 * M13-01 (BUG-42) — Stock-take item count updates.
 *
 * Stock takes are integer inventory control: a negative, fractional, NaN, or
 * string `countedQuantity` corrupts the stored `discrepancy` and can flow into
 * the approval → stock-correction path. The PATCH validates the body here so
 * the API (the source of truth) rejects bad counts with 400 VALIDATION_ERROR
 * before anything is written.
 */
export const StockTakeItemUpdateSchema = z.object({
  countedQuantity: z
    .number()
    .int('countedQuantity must be a whole number')
    .min(0, 'countedQuantity cannot be negative')
    .optional(),
  isRecounted: z.boolean().optional(),
});

export type StockTakeItemUpdateInput = z.infer<typeof StockTakeItemUpdateSchema>;
