import "server-only";

import type { CourierErrorCategory } from "@/lib/courier/types";

/**
 * Classify errors from the Trans Express API into typed categories.
 * The adapter returns { ok:false, error:{ category, message } } — never throws
 * for expected API failures.
 */

export interface TransExpressHttpError {
  category: CourierErrorCategory;
  status?: number | undefined;
  message: string;
  details?: unknown | undefined;
}

/** Map an HTTP status (or absence of response) to an error category. */
export function classifyHttpError(
  status: number | undefined,
  fallbackMessage = "Trans Express API error",
): TransExpressHttpError {
  if (status === 401 || status === 403) {
    return { category: "AUTH", status, message: "Trans Express authentication failed" };
  }
  if (status === 429) {
    return { category: "RATE_LIMIT", status, message: "Trans Express rate limit reached" };
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return { category: "VALIDATION", status, message: fallbackMessage };
  }
  if (status !== undefined && status >= 500) {
    return { category: "NETWORK", status, message: "Trans Express server error" };
  }
  return { category: "UNKNOWN", status, message: fallbackMessage };
}

/** Wrap a network-level failure (timeout / DNS / connection refused). */
export function classifyNetworkError(err: unknown): TransExpressHttpError {
  return {
    category: "NETWORK",
    message: err instanceof Error ? err.message : "Network error reaching Trans Express",
  };
}

/** Extract a human-readable message from a parsed API error body, if present. */
export function extractApiMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const candidate = (body as Record<string, unknown>);
    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message;
    }
    if (typeof candidate.error === "string" && candidate.error) {
      return candidate.error;
    }
    if (typeof candidate.success === "string" && candidate.success) {
      return candidate.success;
    }
  }
  return fallback;
}
