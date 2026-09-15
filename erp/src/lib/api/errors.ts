import 'server-only';

/**
 * INF-02 — canonical API error type.
 *
 * One error contract for the whole API: routes throw (or return) `ApiError`s
 * and the shared envelope builders / `withApiErrors` turn them into stable
 * `{ success:false, error:{ code, message, details? } }` responses. The raw
 * message of unknown/Prisma errors is NEVER sent to the client (BUG-21/26/29
 * information-disclosure family).
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'
  // Domain-specific codes some routes already surface (e.g. CATEGORY_IN_USE,
  // BRAND_IN_USE, INSUFFICIENT_STOCK, SKU_CONFLICT). Kept as a widened string
  // union so the shared mapper can preserve an existing contract exactly.
  | (string & {});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static validation(message = 'Validation failed', details?: unknown): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'Insufficient permissions'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'Conflict', details?: unknown): ApiError {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static internal(message = 'An unexpected error occurred'): ApiError {
    return new ApiError(500, 'INTERNAL_SERVER_ERROR', message);
  }
}

/** True when `err` is a thrown `ApiError` (across module instances). */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError || (err as ApiError)?.name === 'ApiError';
}
