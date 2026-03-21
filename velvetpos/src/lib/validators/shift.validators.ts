import { z } from 'zod';

export const OpenShiftSchema = z.object({
  openingFloat: z.number().min(0, 'Opening float must be non-negative'),
  autoClockIn: z.boolean().optional(),
});

export const CloseShiftSchema = z.object({
  closingCashCount: z.number().min(0, 'Closing cash count must be non-negative'),
  notes: z.string().max(500).optional(),
});

export type OpenShiftInput = z.infer<typeof OpenShiftSchema>;
export type CloseShiftInput = z.infer<typeof CloseShiftSchema>;
