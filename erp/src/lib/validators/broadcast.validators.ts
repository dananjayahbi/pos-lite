import { z } from 'zod';

export const BroadcastChannelSchema = z.enum(['EMAIL', 'SMS', 'WHATSAPP']);

export const BroadcastAudienceFiltersSchema = z
  .object({
    tags: z.string().trim().max(500).optional(),
    gender: z.string().optional(),
    minSpend: z.number().min(0).optional(),
    maxSpend: z.number().min(0).optional(),
    birthdayMonth: z.number().int().min(1).max(12).optional(),
  })
  .optional();

/**
 * Payload for `POST /api/broadcast/send`.
 *
 * EMAIL requires a subject (and either HTML or a plain-text message); SMS
 * requires a short message. Images are optional public URLs previously uploaded
 * through `/api/store/upload/broadcast-image`.
 */
export const BroadcastSendSchema = z
  .object({
    channel: BroadcastChannelSchema,
    subject: z.string().trim().max(200).optional(),
    message: z.string().max(20_000).optional(),
    html: z.string().max(200_000).optional(),
    imageUrls: z.array(z.string().url().max(2048)).max(10).optional(),
    filters: BroadcastAudienceFiltersSchema,
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'EMAIL') {
      if (!data.subject?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: 'Email broadcasts require a subject',
        });
      }
      if (!data.html?.trim() && !data.message?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['message'],
          message: 'Email broadcasts require an HTML body or a plain-text message',
        });
      }
      return;
    }

    if (data.channel === 'SMS') {
      if (!data.message?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['message'],
          message: 'SMS broadcasts require a message',
        });
      } else if (data.message.length > 500) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['message'],
          message: 'SMS messages are limited to 500 characters',
        });
      }
    }
  });

export type BroadcastSendInput = z.infer<typeof BroadcastSendSchema>;
