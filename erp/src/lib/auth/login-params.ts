/**
 * Login query-string hygiene (ARGUS #39).
 *
 * Before hydration a native form submit falls back to a GET when the form has
 * no `method`, serialising every named field into the URL. The login form is
 * now `method="post"` to a fallback route, and these helpers make sure a
 * leaked `?email=…&password=…` is stripped from the address bar and never
 * carried into a post-login redirect.
 */

/** Only these login parameters are meaningful; everything else is dropped. */
const ALLOWED_LOGIN_PARAMS = ['callbackUrl', 'sessionExpired', 'js'] as const;

/**
 * NEW-E (M01-05): only same-origin, root-relative callbackUrls are honored —
 * never an absolute foreign URL (open-redirect guard), and never one carrying
 * credential-looking query params.
 */
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null; // protocol-relative → external
  if (raw.includes('/api/')) return null; // never bounce a page to an API path

  try {
    const parsed = new URL(raw, 'http://login.local');
    if (parsed.searchParams.has('password') || parsed.searchParams.has('email')) {
      return null;
    }
  } catch {
    return null;
  }

  return raw;
}

type SearchParamsInput =
  | string
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (typeof input === 'string') return new URLSearchParams(input);
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      if (value[0] !== undefined) params.set(key, value[0]);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

/**
 * Return a query string (without `?`) containing only the allowed login
 * parameters. `email`/`password` and any other unknown key are dropped, so a
 * pre-hydration GET leak cannot be reflected back to the page.
 */
export function sanitizeLoginQuery(input: SearchParamsInput): string {
  const source = toSearchParams(input);
  const clean = new URLSearchParams();
  for (const key of ALLOWED_LOGIN_PARAMS) {
    const value = source.get(key);
    if (value !== null) clean.set(key, value);
  }
  return clean.toString();
}

/** True when a login URL carries credentials that must be stripped. */
export function hasLoginCredentials(input: SearchParamsInput): boolean {
  const source = toSearchParams(input);
  return source.has('email') || source.has('password');
}
