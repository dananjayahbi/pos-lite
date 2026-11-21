import { z } from 'zod';

/**
 * M13-01 (BUG-42) — Stock-take item count updates.
 *
 * Stock takes are integer inventory control: a negative, fractional, NaN, or
 * string `countedQuantity` corrupts the stored `discrepancy` and can flow into
 * the approval → stock-correction path. The PATCH validates the body here so
 * the API (the source of truth) rejects bad counts with 400 VALIDATION_ERROR
 * before anything is written.
 *
 * ARGUS #208: `null` (or a blank string) is the explicit "not counted" state.
 * The UI sends null when the operator clears a count, which clears both the
 * stored count and its discrepancy; omitting the field leaves the row alone.
 */
export const StockTakeItemUpdateSchema = z.object({
  countedQuantity: z.preprocess(
    (value) => (value === '' ? null : value),
    z
      .number()
      .int('countedQuantity must be a whole number')
      .min(0, 'countedQuantity cannot be negative')
      .nullable()
      .optional(),
  ),
  isRecounted: z.boolean().optional(),
});

export type StockTakeItemUpdateInput = z.infer<typeof StockTakeItemUpdateSchema>;
