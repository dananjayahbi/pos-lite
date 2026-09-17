import { z } from 'zod';

/**
 * M07-03 (OBS-82) — schema for PATCH /api/settings/hardware.
 *
 * Replaces the hand-parsed body of the hardware route, which silently coerced
 * invalid input: any out-of-range or string `port` became 9100, and
 * `Boolean(cashDrawerEnabled)` turned the string `"false"` into `true`.
 *
 * Strictness decisions (recorded per the M07-03 fix approach):
 * - `cashDrawerEnabled` / `cfdEnabled` are STRICT booleans — no coercion. A
 *   wrong-typed value is a 400 naming the field, because a silently flipped
 *   drawer/CFD switch is a dangerous semantic change.
 * - `port` is an optional int in 1..65535. Invalid values are a 400 naming the
 *   field; there is deliberately NO silent 9100 fallback any more. When the
 *   key is omitted the route keeps the stored value (PATCH semantics).
 * - `host` may be empty for non-network printer types (matches the previous
 *   route behaviour); the NETWORK-requires-host rule stays in the route.
 * - Asymmetry vs the taxes route (which keeps `Number()` coercion for rates):
 *   numeric strings are benign for rates but boolean coercion is not, so
 *   hardware validates strictly while taxes stays tolerant.
 */
export const HardwareSettingsSchema = z.object({
  printerType: z.enum(['NETWORK', 'USB'], {
    error: 'printerType must be one of NETWORK, USB',
  }),
  host: z.string().trim().max(255, { error: 'host must be a string of at most 255 characters' }),
  port: z
    .number({ error: 'port must be a number' })
    .int({ error: 'port must be an integer' })
    .min(1, { error: 'port must be between 1 and 65535' })
    .max(65535, { error: 'port must be between 1 and 65535' })
    .optional(),
  cashDrawerEnabled: z.boolean({ error: 'cashDrawerEnabled must be a boolean' }),
  cfdEnabled: z.boolean({ error: 'cfdEnabled must be a boolean' }),
});

export type HardwareSettingsInput = z.infer<typeof HardwareSettingsSchema>;
