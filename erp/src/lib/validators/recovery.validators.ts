import { z } from 'zod';

/**
 * Recovery validators — bundle-safe (mirror the Prisma `RecoveryAction` enum
 * locally) so they can be reused by client components. Logged actions are
 * restricted to the two non-destructive states; redelivery and permanent
 * cancel have their own endpoints.
 */
export const LOGGED_RECOVERY_ACTIONS = ['FOLLOW_UP_CALL', 'RESCHEDULED'] as const;

export const LogRecoveryActionSchema = z.object({
  action: z.enum(LOGGED_RECOVERY_ACTIONS),
  notes: z.string().trim().max(2000).optional(),
});

export const RedeliverDeliverySchema = z.object({
  waybillMode: z.enum(['MANUAL', 'AUTO']).default('AUTO'),
  manualWaybillId: z
    .string()
    .trim()
    .min(8, 'Manual waybill id is required (at least 8 characters)')
    .max(40)
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const PermanentCancelDeliverySchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(500).optional(),
});

export type LogRecoveryActionInput = z.infer<typeof LogRecoveryActionSchema>;
export type RedeliverDeliveryInput = z.infer<typeof RedeliverDeliverySchema>;
export type PermanentCancelDeliveryInput = z.infer<typeof PermanentCancelDeliverySchema>;
