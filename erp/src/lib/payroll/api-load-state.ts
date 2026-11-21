/**
 * Payroll load/error state helpers (ARGUS #377).
 *
 * The payroll screens used to read `json.data ?? []` and render an empty
 * business state when the request failed: a 404 looked like "No payroll has
 * been generated yet", and a non-JSON error body surfaced a raw JSON parser
 * message ("Unexpected token '<'..."). These helpers keep the state machine
 * pure and the failure copy predictable; they are shared by both payroll
 * screens.
 */

export type PayrollLoadState = 'loading' | 'error' | 'empty' | 'ready';

export interface PayrollLoadStateInput {
  isLoading: boolean;
  isError: boolean;
  /** True when the query produced at least one usable row. */
  hasData: boolean;
}

/**
 * Error always wins over data/empty: a failed request must never render a
 * business empty state. Loading only wins before any data is available.
 */
export function resolvePayrollLoadState(input: PayrollLoadStateInput): PayrollLoadState {
  if (input.isError) return 'error';
  if (input.isLoading && !input.hasData) return 'loading';
  if (!input.hasData) return 'empty';
  return 'ready';
}

export interface PayrollApiFailure {
  status: number;
  /** Stable API error code when the envelope was well formed. */
  code: string | null;
  /** Safe, human-readable copy. Never a parser/runtime message. */
  message: string;
}

export interface PayrollApiEnvelope<T> {
  success: boolean;
  data?: T;
  failure?: PayrollApiFailure;
}

function statusMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Sign in again to load payroll.';
  if (status === 403) return 'You do not have permission to view payroll.';
  if (status === 404) return 'The requested payroll record was not found.';
  if (status >= 500) return 'The payroll service is unavailable. Try again in a moment.';
  return `The payroll request failed (HTTP ${status}).`;
}

interface EnvelopeShape {
  success?: unknown;
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
}

/**
 * Parse a payroll response body without ever leaking a JSON parser message.
 * A valid `{ success:false, error:{ message } }` envelope wins; any other body
 * (HTML error page, empty 502, truncated JSON) falls back to status-based copy.
 */
export function parsePayrollApiEnvelope<T>(
  status: number,
  bodyText: string | null | undefined,
): PayrollApiEnvelope<T> {
  let parsed: EnvelopeShape | null = null;
  if (typeof bodyText === 'string' && bodyText.trim().length > 0) {
    try {
      const value: unknown = JSON.parse(bodyText);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        parsed = value as EnvelopeShape;
      }
    } catch {
      parsed = null;
    }
  }

  const envelopeMessage =
    parsed && typeof parsed.error?.message === 'string' && parsed.error.message.trim().length > 0
      ? parsed.error.message.trim()
      : null;
  const envelopeCode =
    parsed && typeof parsed.error?.code === 'string' && parsed.error.code.trim().length > 0
      ? parsed.error.code.trim()
      : null;

  const success = status >= 200 && status < 300 && parsed?.success === true;
  if (success) {
    return { success: true, data: parsed?.data as T };
  }

  return {
    success: false,
    failure: {
      status,
      code: envelopeCode,
      message: envelopeMessage ?? statusMessage(status),
    },
  };
}

/**
 * Fetch + parse a payroll GET. Throws a safe `Error` message so React Query's
 * `isError` path renders the load-error card instead of an empty state.
 */
export async function fetchPayrollEnvelope<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const parsed = parsePayrollApiEnvelope<T>(response.status, text);
  if (!parsed.success) {
    throw new Error(parsed.failure?.message ?? statusMessage(response.status));
  }
  return parsed.data as T;
}
