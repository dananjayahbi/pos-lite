import 'server-only';

import { ApiError } from './errors';

/**
 * INF-02 — single service-error → HTTP mapper.
 *
 * Services across the app throw `Error`s whose `.message` is either a stable
 * sentinel token (`NOT_FOUND`, `INSUFFICIENT_STOCK:…`, `*_IN_USE`, …) or —
 * in the older product/customer services — a fixed prose message. This is
 * the ONE place that maps them to typed responses, so a new sentinel is
 * registered once instead of hand-written per route, and the raw message of
 * unexpected errors is never echoed to the client.
 *
 * Fixes the "routine client error → 500" family (BUG-50/66/67): e.g. the
 * reconciliation dispute sentinels (LEDGER_ENTRY_NOT_FOUND / DISPUTE_NOT_FOUND
 * / ALREADY_DISPUTED) previously fell through to internalError().
 *
 * Note: `toErrorResponse` runs the Prisma mapper BEFORE this one, so a raw
 * Prisma dump that happens to contain "already exists" gets the field-aware
 * P2002 message instead of a prose match.
 *
 * Delivery-family sentinels keep their dedicated friendly copy via
 * `mapDeliveryError` (delivery-route.ts); the generic rules below still
 * classify them sanely (404/409/400) for any route that uses this mapper.
 */

interface Rule {
  match: (message: string) => boolean;
  status: number;
  code: string;
  message: string;
}

const token =
  (name: string) =>
  (m: string): boolean =>
    m === name || m.startsWith(`${name}:`) || m.startsWith(`${name} `);
const exact =
  (name: string) =>
  (m: string): boolean =>
    m === name;
const suffix =
  (s: string) =>
  (m: string): boolean =>
    m.endsWith(s) && /^[A-Z][A-Z0-9_]+$/.test(m);

/** Ordered — first match wins. Keep generic rules last. */
const RULES: Rule[] = [
  // ── Generic sentinel tokens ────────────────────────────────────────────
  { match: exact('NOT_FOUND'), status: 404, code: 'NOT_FOUND', message: 'The requested record was not found.' },
  { match: exact('FORBIDDEN'), status: 403, code: 'FORBIDDEN', message: 'Insufficient permissions' },
  { match: exact('BELOW_ZERO'), status: 400, code: 'BELOW_ZERO', message: 'This adjustment would take stock below zero.' },
  { match: exact('DELTA_ZERO'), status: 400, code: 'DELTA_ZERO', message: 'The change amount must be non-zero.' },
  { match: exact('BOM_EXISTS'), status: 409, code: 'BOM_EXISTS', message: 'A bill of materials already exists for this variant.' },
  { match: exact('BOM_INACTIVE'), status: 409, code: 'BOM_INACTIVE', message: 'The bill of materials is inactive.' },
  { match: exact('NO_INGREDIENTS'), status: 400, code: 'NO_INGREDIENTS', message: 'The bill of materials has no ingredients.' },
  { match: exact('ALREADY_CONVERTED'), status: 409, code: 'ALREADY_CONVERTED', message: 'This record has already been converted.' },
  { match: exact('ALREADY_DISPUTED'), status: 409, code: 'ALREADY_DISPUTED', message: 'This entry is already under dispute.' },
  { match: exact('SERVICE_NAME_EXISTS'), status: 409, code: 'CONFLICT', message: 'A service with this name already exists.' },
  { match: exact('STAFF_UNAVAILABLE'), status: 409, code: 'STAFF_UNAVAILABLE', message: 'The staff member is not available for this slot.' },
  { match: exact('TRADED_NOT_MANUFACTURED'), status: 400, code: 'TRADED_NOT_MANUFACTURED', message: 'A traded (non-manufactured) item cannot be produced.' },
  { match: exact('NO_OWNER'), status: 400, code: 'NO_OWNER', message: 'The tenant has no owner account.' },
  { match: token('INSUFFICIENT_STOCK'), status: 409, code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock to complete this operation.' },
  { match: token('CONFLICT'), status: 409, code: 'CONFLICT', message: 'This operation conflicts with existing data.' },

  // ── Prose messages from the older product/customer services ────────────
  // Status + code are preserved exactly as the routes returned them; only the
  // raw-dump echo disappears (friendly static message instead).
  { match: exact('Product not found'), status: 404, code: 'NOT_FOUND', message: 'Product not found' },
  { match: exact('Variant not found'), status: 404, code: 'NOT_FOUND', message: 'Variant not found' },
  { match: exact('Category not found'), status: 404, code: 'NOT_FOUND', message: 'Category not found' },
  { match: exact('Brand not found'), status: 404, code: 'NOT_FOUND', message: 'Brand not found' },
  { match: exact('Customer not found'), status: 404, code: 'NOT_FOUND', message: 'Customer not found' },
  {
    match: exact('Cannot delete category while products are assigned to it'),
    status: 409,
    code: 'CATEGORY_IN_USE',
    message: 'Cannot delete category while products are assigned to it',
  },
  {
    match: exact('Cannot delete brand while products are assigned to it'),
    status: 409,
    code: 'BRAND_IN_USE',
    message: 'Cannot delete brand while products are assigned to it',
  },
  {
    // Known duplicate-name prose from product.service / customer.service /
    // staff route. Never matches a Prisma dump — the Prisma mapper runs first.
    match: (m) =>
      m === 'A category with this name already exists' ||
      m === 'A brand with this name already exists' ||
      m === 'A customer with this phone number already exists' ||
      m === 'A user with this email already exists' ||
      m.startsWith('SKU already exists:') ||
      m.startsWith('Duplicate SKU in batch:'),
    status: 409,
    code: 'CONFLICT',
    message: 'A record with these details already exists.',
  },

  // ── Suffix families for tokens not enumerated above (BUG-66 class) ─────
  { match: suffix('_NOT_FOUND'), status: 404, code: 'NOT_FOUND', message: 'The requested record was not found.' },
  { match: suffix('_IN_USE'), status: 409, code: 'CONFLICT', message: 'This record is still referenced by other data.' },
  { match: suffix('_EXISTS'), status: 409, code: 'CONFLICT', message: 'A record with these details already exists.' },
];

/**
 * Map a thrown value to a typed `ApiError` when its message matches a
 * registered service sentinel/prose rule. Returns null otherwise, so the
 * caller can fall through to the Prisma mapper or a generic 500.
 */
export function mapServiceError(error: unknown): ApiError | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return null;
  const rule = RULES.find((r) => r.match(message));
  return rule ? new ApiError(rule.status, rule.code, rule.message) : null;
}
