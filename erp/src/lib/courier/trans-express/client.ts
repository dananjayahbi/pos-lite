import "server-only";

import { resolveBaseUrl, TRANSEXPRESS_RETRY } from "@/lib/constants/courier";
import {
  classifyHttpError,
  classifyNetworkError,
  extractApiMessage,
} from "@/lib/courier/trans-express/errors";
import type { CourierErrorCategory, CourierResult } from "@/lib/courier/types";
import type { CourierEnv } from "@/generated/prisma/client";

interface RequestOptions {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Low-level Trans Express HTTP client. Resolves the base URL from the per-tenant
 * environment, applies a bearer token, enforces timeouts, and retries transient
 * failures (network / 5xx / rate-limit) with exponential backoff.
 *
 * Returns a typed CourierResult — expected API failures never throw.
 */
export async function transExpressRequest<T>(
  env: CourierEnv,
  path: string,
  options: RequestOptions = {},
): Promise<CourierResult<T>> {
  const baseUrl = resolveBaseUrl(env);
  const { method = "GET", token, body, timeoutMs = 15_000 } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let lastCategory: CourierErrorCategory = "UNKNOWN";
  let lastMessage = "Trans Express request failed";

  for (let attempt = 0; attempt < TRANSEXPRESS_RETRY.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
        cache: "no-store",
      };
      if (body !== undefined) init.body = JSON.stringify(body);

      const res = await fetch(`${baseUrl}${path}`, init);

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const { category, status } = classifyHttpError(res.status);
        lastCategory = category;
        lastMessage = extractApiMessage(json, `Trans Express ${method} ${path} failed (${status})`);

        // Retry transient failures (network, 5xx, rate-limit); never retry auth/validation.
        const retryable =
          (status !== undefined && status >= 500) || category === "RATE_LIMIT" || category === "NETWORK";
        if (retryable && attempt < TRANSEXPRESS_RETRY.maxAttempts - 1) {
          await sleep(TRANSEXPRESS_RETRY.backoffMs[attempt] ?? 1_000);
          continue;
        }
        return { ok: false, error: { category, message: lastMessage, details: json ?? undefined } };
      }

      return { ok: true, data: json as T };
    } catch (err) {
      const network = classifyNetworkError(err);
      lastCategory = network.category;
      lastMessage = network.message;
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const retryable = isTimeout || network.category === "NETWORK";
      if (retryable && attempt < TRANSEXPRESS_RETRY.maxAttempts - 1) {
        await sleep(TRANSEXPRESS_RETRY.backoffMs[attempt] ?? 1_000);
        continue;
      }
      return {
        ok: false,
        error: {
          category: lastCategory,
          message: isTimeout ? `Trans Express request timed out after ${timeoutMs}ms` : lastMessage,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: { category: lastCategory, message: lastMessage } };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
