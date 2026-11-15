import { z } from 'zod';

/**
 * The waybill design is fixed; the template only stores the sender identity
 * that changes per tenant.
 */
export const LabelTemplateSchema = z.object({
  brandName: z.string().max(60),
  fromContact: z.string().max(60).default(''),
});

export type LabelTemplateInput = z.infer<typeof LabelTemplateSchema>;
