import { z } from 'zod';

/**
 * INF-04 — shared validator primitives.
 *
 * `zPrice`: money input contract for request bodies — accept string-or-number,
 * finite, at most 2 decimal places, non-negative unless `allowNegative`.
 * Output is a JS number (services pass it straight to Prisma Decimal fields).
 * Reused by M03-05 (commission), M15-02 (promotion value), M27-07 (price max),
 * and the XC-01 query coercion path.
 */

const DECIMAL_2DP_RE = /^-?\d+(\.\d{1,2})?$/;

export function zPrice(opts: { allowNegative?: boolean } = {}) {
  return z
    .union([z.string().trim(), z.number()])
    .refine(
      (v) => {
        const s = String(v);
        if (s.trim() === '' || s === 'NaN' || s === 'Infinity' || s === '-Infinity') return false;
        if (!DECIMAL_2DP_RE.test(s)) return false;
        const n = Number(s);
        if (!Number.isFinite(n)) return false;
        if (!opts.allowNegative && Object.is(n, -0)) return false;
        return opts.allowNegative ? true : n >= 0;
      },
      opts.allowNegative
        ? 'Must be a number with at most 2 decimal places'
        : 'Must be a non-negative number with at most 2 decimal places',
    )
    .transform((v) => Number(String(v)));
}
