/**
 * Safe API response parsing for client queries (ARGUS #353).
 *
 * A failed page query used to call `res.json()` before checking `res.ok`. A
 * 404/500 HTML body therefore surfaced as `Unexpected token '<' ...` and the
 * page kept rendering zeroed summary cards. These helpers:
 *
 * - read the body as text and tolerate non-JSON/empty responses;
 * - prefer the API envelope's own `error.message`;
 * - fall back to a stable human sentence plus the HTTP status, never the raw
 *   parser error or response body.
 */

export type SafeJsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; value: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read and parse a response body without ever throwing. */
export async function readJsonBody<T = unknown>(
  response: Pick<Response, 'text'>,
): Promise<SafeJsonResult<T>> {
  try {
    const text = await response.text();
    if (!text.trim()) return { ok: false, value: null };
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, value: null };
  }
}

/** Read `{ error: { message } }` from a parsed envelope, bounded and trimmed. */
export function envelopeErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const error = body.error;
  if (!isRecord(error)) return null;
  const message = error.message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (trimmed === '') return null;
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
}

export interface DescribeApiFailureInput {
  ok: boolean;
  status: number;
  /** Parsed JSON body, or null when the body was not JSON. */
  body: unknown;
  /** Human fallback, e.g. "Attendance could not be loaded". */
  fallback: string;
}

/**
 * Human failure message. The raw response text is never included; a non-JSON
 * body becomes the fallback plus `HTTP <status>`.
 */
export function describeApiFailure(input: DescribeApiFailureInput): string {
  const message = envelopeErrorMessage(input.body);
  if (!input.ok) {
    const detail = message ?? `HTTP ${input.status}`;
    return `${input.fallback} (${detail})`;
  }
  return message ?? input.fallback;
}
