/**
 * Commission report load/error state (ARGUS #363).
 *
 * The report page used `data?.data ?? []`, so a 404/500 rendered as a zero
 * business state: Open liability Rs 0.00, "No commission data" and "No
 * payouts". These helpers make a failed request an explicit error state that
 * wins over stale/empty data, with safe copy instead of parser messages.
 */

export type CommissionReportState = 'loading' | 'error' | 'empty' | 'ready';

export interface CommissionReportStateInput {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
}

/** Error always wins; empty is reserved for a successful empty response. */
export function resolveCommissionReportState(
  input: CommissionReportStateInput,
): CommissionReportState {
  if (input.isError) return 'error';
  if (input.isLoading && !input.hasData) return 'loading';
  if (!input.hasData) return 'empty';
  return 'ready';
}

export interface CommissionApiFailure {
  status: number;
  code: string | null;
  message: string;
}

export interface CommissionApiEnvelope<T> {
  success: boolean;
  data?: T;
  failure?: CommissionApiFailure;
}

function statusMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Sign in again to load commissions.';
  if (status === 403) return 'You do not have permission to view commission reports.';
  if (status === 404) return 'The commission report was not found.';
  if (status >= 500) return 'The commission service is unavailable. Try again in a moment.';
  return `The commission request failed (HTTP ${status}).`;
}

/** Parse without leaking a raw JSON parser/runtime message. */
export function parseCommissionApiEnvelope<T>(
  status: number,
  bodyText: string | null | undefined,
): CommissionApiEnvelope<T> {
  interface EnvelopeShape {
    success?: unknown;
    data?: unknown;
    error?: { code?: unknown; message?: unknown };
  }

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

  if (status >= 200 && status < 300 && parsed?.success === true) {
    return { success: true, data: parsed.data as T };
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

/** Fetch + parse a commission GET, throwing safe copy for React Query. */
export async function fetchCommissionEnvelope<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const text = await response.text();
  const parsed = parseCommissionApiEnvelope<T>(response.status, text);
  if (!parsed.success) {
    throw new Error(parsed.failure?.message ?? statusMessage(response.status));
  }
  return parsed.data as T;
}
