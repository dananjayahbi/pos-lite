import 'server-only';

import { ApiError } from './errors';

/**
 * XC-01 — shared query-param parsing. Kills the "malformed param → 500"
 * family (BUG-28/32/40/45/51/74/75/81/82/84/89/91).
 *
 * Contract (encoded by the QA pins):
 *  - missing param           → `default` (or undefined)
 *  - malformed (non-numeric, invalid date, etc.) → 400 BAD_REQUEST naming the param
 *  - valid but out-of-range  → clamped to [min, max]
 *
 * Routes throw these `ApiError`s inside their try blocks; `withApiErrors` /
 * `toErrorResponse` turn them into the envelope response.
 */

function raw(params: URLSearchParams, name: string): string | null {
  const v = params.get(name);
  return v === null || v.trim() === '' ? null : v.trim();
}

export interface IntOptions {
  default?: number;
  min?: number;
  max?: number;
}

/** Integer query param. Malformed → 400; out-of-range → clamped. */
export function parseQueryInt(
  params: URLSearchParams,
  name: string,
  opts: IntOptions = {},
): number | undefined {
  const value = raw(params, name);
  if (value === null) return opts.default;
  if (!/^-?\d+$/.test(value)) {
    throw ApiError.badRequest(`Query parameter "${name}" must be an integer`);
  }
  const n = Number(value);
  if (opts.min !== undefined && n < opts.min) return opts.min;
  if (opts.max !== undefined && n > opts.max) return opts.max;
  return n;
}

/** Decimal query param (money/quantities). Malformed → 400; out-of-range → clamped. */
export function parseQueryNumber(
  params: URLSearchParams,
  name: string,
  opts: IntOptions = {},
): number | undefined {
  const value = raw(params, name);
  if (value === null) return opts.default;
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw ApiError.badRequest(`Query parameter "${name}" must be a number`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw ApiError.badRequest(`Query parameter "${name}" must be a finite number`);
  }
  if (opts.min !== undefined && n < opts.min) return opts.min;
  if (opts.max !== undefined && n > opts.max) return opts.max;
  return n;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date query param. Accepts ISO 8601 (date or datetime); rejects garbage and
 * calendar-invalid dates (2026-02-31 → 400, not a silent roll-over) instead
 * of leaking an Invalid Date into a Prisma filter.
 */
export function parseQueryDate(params: URLSearchParams, name: string): Date | undefined {
  const value = raw(params, name);
  if (value === null) return undefined;
  if (!ISO_DATE_RE.test(value)) {
    throw ApiError.badRequest(`Query parameter "${name}" must be an ISO date (YYYY-MM-DD)`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw ApiError.badRequest(`Query parameter "${name}" is not a valid date`);
  }
  // Calendar-validity check for plain dates: JS silently rolls 2026-02-30
  // over to 2026-03-02 — reject the caller's mistake instead.
  const dateOnly = DATE_ONLY_RE.exec(value);
  if (dateOnly) {
    const [, y, m, day] = dateOnly;
    if (
      d.getUTCFullYear() !== Number(y) ||
      d.getUTCMonth() + 1 !== Number(m) ||
      d.getUTCDate() !== Number(day)
    ) {
      throw ApiError.badRequest(`Query parameter "${name}" is not a real calendar date`);
    }
  }
  return d;
}

/** Boolean query param: 'true'/'1' → true, 'false'/'0' → false, else 400. */
export function parseQueryBool(
  params: URLSearchParams,
  name: string,
  opts: { default?: boolean } = {},
): boolean | undefined {
  const value = raw(params, name);
  if (value === null) return opts.default;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw ApiError.badRequest(`Query parameter "${name}" must be true or false`);
}

/** Pagination pair with the codebase-wide defaults (page ≥1, limit 1..200). */
export function parsePagination(
  params: URLSearchParams,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number } {
  return {
    page: parseQueryInt(params, 'page', { default: 1, min: 1 }) ?? 1,
    limit:
      parseQueryInt(params, 'limit', {
        default: opts.defaultLimit ?? 20,
        min: 1,
        max: opts.maxLimit ?? 200,
      }) ?? 20,
  };
}
