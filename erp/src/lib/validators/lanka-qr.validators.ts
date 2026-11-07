import { z } from 'zod';
import { isRenderableQrImageUrl } from '@/lib/payments/lanka-qr-config';

/**
 * Body schema for PATCH /api/settings/payments (LankaQR block).
 * Every field is required so a partial/typo'd payload cannot silently reset
 * the merchant identity; the settings form always sends the full object.
 */
export const LankaQrSettingsSchema = z.object({
  enabled: z.boolean(),
  merchantName: z.string().trim().max(80, 'Merchant name must be 80 characters or less'),
  merchantId: z.string().trim().max(40, 'Merchant ID must be 40 characters or less'),
  bankName: z.string().trim().max(80, 'Bank name must be 80 characters or less'),
  qrImageUrl: z
    .string()
    .trim()
    .max(2048, 'QR image URL is too long')
    .refine(
      (value) => value === '' || isRenderableQrImageUrl(value),
      'QR image must be an http(s) URL or a path starting with /',
    ),
  instructions: z
    .string()
    .trim()
    .max(240, 'Instructions must be 240 characters or less'),
  referenceRequired: z.boolean(),
  allowSplit: z.boolean(),
});

export type LankaQrSettingsInput = z.infer<typeof LankaQrSettingsSchema>;
