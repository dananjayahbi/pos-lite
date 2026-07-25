/**
 * Server-side fetch wrapper for the ERP backend.
 *
 * Responsibilities:
 *  - Resolve relative API paths against `NEXT_PUBLIC_API_BASE_URL`.
 *  - Pass through the Next.js cache directives (`next.revalidate`).
 *  - Surface meaningful errors with status + parsed body.
 *  - Handle JSON encoding/decoding transparently.
 *
 * This module must only be imported from server components, route
 * handlers, or server-side data utilities. It reads env vars that are
 * inlined into the bundle and must never leak to the client.
 */

import { buildApiUrl } from '@/lib/utils';
import { SITE } from '@/config/site';

export interface ApiFetchOptions extends Omit<RequestInit, 'cache'> {
  /** Next.js cache directive. Defaults to `force-cache` with the site ISR interval. */
  revalidate?: number | false;
  /** Cache tags for fine-grained invalidation. */
  tags?: string[];
  /** When true, skip cache entirely (forces a fresh fetch). */
  noStore?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch a JSON resource from the ERP backend.
 *
 * @example
 *   const config = await apiFetch<WebsiteConfigData>(
 *     `/api/public/site/${slug}/config`,
 *     { tags: [`site-${slug}`] }
 *   );
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = buildApiUrl(SITE.apiBaseUrl, path);
  if (!url) {
    throw new ApiError(
      `Cannot build ERP API URL — NEXT_PUBLIC_API_BASE_URL is not configured.`,
      0,
    );
  }

  const { revalidate, tags, noStore, headers, ...rest } = options;

  // Build Next.js cache options.
  const nextOptions: { revalidate?: number | false; tags?: string[] } = {};
  if (noStore) {
    nextOptions.revalidate = 0;
  } else if (revalidate !== undefined) {
    nextOptions.revalidate = revalidate;
  } else {
    nextOptions.revalidate = SITE.revalidateSeconds;
  }
  if (tags && tags.length > 0) nextOptions.tags = tags;

  const response = await fetch(url, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    next: nextOptions,
  });

  if (!response.ok) {
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      // ignore — body is optional
    }
    throw new ApiError(
      `ERP API ${response.status} on ${path}: ${response.statusText}`,
      response.status,
      body,
    );
  }

  // Some endpoints may return empty bodies; treat as null.
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      `ERP API returned non-JSON body for ${path}`,
      response.status,
      text,
    );
  }
}

/** Convenience GET helper. */
export function apiGet<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'GET' });
}