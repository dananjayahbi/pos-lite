import 'server-only';

import { NextResponse } from 'next/server';

import { ApiError, isApiError } from './errors';
import { mapPrismaError } from './map-prisma-error';
import { mapServiceError } from './map-service-error';

/**
 * INF-02 — canonical response envelope builders.
 *
 * Success: `{ success:true, data, meta? }`
 * Error:   `{ success:false, error:{ code, message, details? } }`
 * (contract documented in `docs/api-envelope.md` — XC-02).
 */

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

export function ok<T>(data: T, init?: { status?: number; meta?: ResponseMeta }): NextResponse {
  const body = init?.meta ? { success: true, data, meta: init.meta } : { success: true, data };
  return NextResponse.json(body, init?.status ? { status: init.status } : undefined);
}

export function envelopeError(err: ApiError): NextResponse {
  const body =
    err.details === undefined
      ? { success: false, error: { code: err.code, message: err.message } }
      : { success: false, error: { code: err.code, message: err.message, details: err.details } };
  return NextResponse.json(body, { status: err.status });
}

// Back-compat typed builders (promoted from delivery-route.ts) -------------

export function unauthorized(message: string): NextResponse {
  return envelopeError(ApiError.unauthorized(message));
}

export function forbidden(message: string): NextResponse {
  return envelopeError(ApiError.forbidden(message));
}

export function validationError(details: unknown, message = 'Validation failed'): NextResponse {
  return envelopeError(new ApiError(400, 'VALIDATION_ERROR', message, details));
}

export function notFound(message: string): NextResponse {
  return envelopeError(ApiError.notFound(message));
}

export function conflict(message: string): NextResponse {
  return envelopeError(ApiError.conflict(message));
}

export function badRequest(message: string): NextResponse {
  return envelopeError(ApiError.badRequest(message));
}

export function internalError(message: string): NextResponse {
  return envelopeError(ApiError.internal(message));
}

/**
 * M24-01/OBS-32: upstream-dependency failure (courier API unreachable/auth
 * rejected/etc). 502 Bad Gateway — distinct from a client `badRequest` so an
 * outage is not indistinguishable from a malformed request.
 */
export function upstreamError(code: string, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: 502 },
  );
}

/**
 * Single catch-line for route handlers. Resolution order:
 * 1. thrown `ApiError` → its status/code as-is.
 * 2. service sentinel strings (`map-service-error`) → typed response.
 * 3. Prisma known-request errors (`map-prisma-error`) → 400/404/409 friendly.
 * 4. anything else → logged server-side, generic 500 with NO internals.
 */
export function toErrorResponse(error: unknown, label = 'api'): NextResponse {
  if (isApiError(error)) return envelopeError(error);

  const mapped = mapPrismaError(error) ?? mapServiceError(error);
  if (mapped) return envelopeError(mapped);

  console.error(`[${label}] unhandled error:`, error);
  return internalError('An unexpected error occurred');
}

/** Higher-order wrapper so each route's error handling is one line. */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
  label = 'api',
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error, label);
    }
  };
}
