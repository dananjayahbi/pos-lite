import { z } from 'zod';

export const PayrollMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM');

export const PayrollOverrideSchema = z.object({
  userId: z.string().min(1),
  noPayDays: z.number().min(0).max(31).optional(),
  advanceDeduction: z.number().min(0).max(100_000_000).optional(),
});

export const GeneratePayrollSchema = z.object({
  month: PayrollMonthSchema,
  notes: z.string().trim().max(500).optional(),
  overrides: z.array(PayrollOverrideSchema).max(500).default([]),
});

export const PayrollSettingsSchema = z.object({
  employerEpfNumber: z.string().trim().max(40),
  employerEtfNumber: z.string().trim().max(40),
  workingDays: z.number().int().min(0).max(31),
  overtimeMultiplier: z.number().min(1).max(4),
});

export type GeneratePayrollInput = z.infer<typeof GeneratePayrollSchema>;
export type PayrollSettingsInput = z.infer<typeof PayrollSettingsSchema>;
