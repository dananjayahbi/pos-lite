import { PaymentMethod, SaleStatus } from '@/generated/prisma/client';

/**
 * Query-param validation for the sales list API (ARGUS #79).
 *
 * `status` used to be cast straight to the Prisma enum, so an unknown value
 * reached the query and surfaced as a 500. `paymentMethod` (added in #77) was
 * silently ignored. Both are now parsed here and rejected with a typed 400
 * naming the parameter; valid values and blank/absent values behave as before.
 */

type ParseResult<T> =
  | { ok: true; value: T | undefined }
  | { ok: false; param: 'status' | 'paymentMethod'; message: string };

export const SALE_STATUS_VALUES: readonly SaleStatus[] = Object.values(SaleStatus);
export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = Object.values(PaymentMethod);

function parseEnumParam<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  param: 'status' | 'paymentMethod',
): ParseResult<T> {
  if (raw === null || raw === undefined) return { ok: true, value: undefined };
  const value = raw.trim();
  if (value === '') return { ok: true, value: undefined };
  if ((allowed as readonly string[]).includes(value)) {
    return { ok: true, value: value as T };
  }
  return {
    ok: false,
    param,
    message: `Invalid ${param} "${value}". Allowed values: ${allowed.join(', ')}`,
  };
}

export function parseSaleStatus(raw: string | null | undefined): ParseResult<SaleStatus> {
  return parseEnumParam(raw, SALE_STATUS_VALUES, 'status');
}

export function parseSalePaymentMethod(
  raw: string | null | undefined,
): ParseResult<PaymentMethod> {
  return parseEnumParam(raw, PAYMENT_METHOD_VALUES, 'paymentMethod');
}
