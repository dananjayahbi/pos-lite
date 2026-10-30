/**
 * Transport for the payment-account endpoints.
 *
 * Every route answers with the standard `{ success, data }` envelope, so one
 * helper unwraps it and turns a failed response into an `Error` whose message
 * is the server's own wording (validation messages, "insufficient funds", …).
 */

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

export async function readEnvelope<T>(response: Response): Promise<T> {
  let json: Envelope<T> | null = null;
  try {
    json = (await response.json()) as Envelope<T>;
  } catch {
    json = null;
  }

  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed (${response.status})`);
  }
  if (json.data === undefined) {
    throw new Error('The server returned no data');
  }
  return json.data;
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return readEnvelope<T>(response);
}

export async function sendJson<T>(
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readEnvelope<T>(response);
}

/** Build `?a=1&b=2`, dropping empty values so the API sees no blank filters. */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
