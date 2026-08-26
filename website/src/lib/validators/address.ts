import { z } from 'zod';

/**
 * Client-side address validation for the website checkout. Mirrors the ERP
 * `WebsiteCheckoutSchema` so the user sees errors before submitting.
 */
export const CheckoutAddressSchema = z.object({
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
});

export type CheckoutAddressInput = z.infer<typeof CheckoutAddressSchema>;
