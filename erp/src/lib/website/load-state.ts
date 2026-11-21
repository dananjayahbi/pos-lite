export interface WebsiteConfigPayload {
  success?: boolean;
  data?: unknown;
  error?: { message?: string };
}

export type WebsiteLoadResult =
  | { kind: 'ready'; data: Record<string, unknown> }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

/**
 * Classify the website-config GET response (ARGUS #495).
 *
 * A failed request and a tenant with no config must never be treated as "ready
 * with defaults": the old form merged the demo tenant's copy into both cases and
 * a save could overwrite or create another tenant's content. Empty config is an
 * explicit state; a failure is an error state with no form/save.
 */
export function resolveWebsiteLoadResult(input: {
  ok: boolean;
  status?: number | undefined;
  body: unknown;
}): WebsiteLoadResult {
  const body = input.body as WebsiteConfigPayload | null | undefined;

  if (!input.ok) {
    return {
      kind: 'error',
      message:
        body?.error?.message ??
        `Failed to load the website configuration (HTTP ${input.status ?? 'error'}).`,
    };
  }

  if (!body || typeof body !== 'object' || body.success !== true) {
    return { kind: 'error', message: 'The website configuration response was invalid.' };
  }

  if (!body.data || typeof body.data !== 'object') {
    return { kind: 'empty' };
  }

  return { kind: 'ready', data: body.data as Record<string, unknown> };
}
