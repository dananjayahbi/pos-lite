import { z } from 'zod';

/**
 * Public checkout payload schema for website orders. This schema is used by the
 * public order-placement endpoint; it intentionally mirrors the required
 * `ShippingAddress` fields and basic order values.
 */
export const CheckoutLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  productName: z.string().max(200).optional(),
  sku: z.string().max(100).optional(),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(999),
});

export const WebsiteCheckoutSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(120),
  phone: z
    .string()
    .min(7, 'Enter a valid phone number')
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number'),
  phone2: z.string().max(20).optional(),
  addressLine1: z.string().min(1, 'Address is required').max(255),
  addressLine2: z.string().max(255).optional(),
  cityName: z.string().min(1, 'City is required').max(120),
  districtName: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  itemCount: z.number().int().min(1).max(999).optional(),
  codAmount: z.number().min(0).optional(),
  totalWeightKg: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(CheckoutLineSchema).max(200).optional(),
});

export type WebsiteCheckoutInput = z.infer<typeof WebsiteCheckoutSchema>;
