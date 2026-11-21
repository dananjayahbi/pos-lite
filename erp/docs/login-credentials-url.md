# Login credentials must never appear in the URL (ARGUS #39)

## Root cause

The sign-in form was a bare `<form onSubmit={…}>`. Before React hydrates (slow
first load), a quick submit is handled by the browser's native form behaviour.
With no `method`, that fallback is **GET**, so the browser navigated to
`/login?email=…&password=…` using the `name` attributes of the inputs. The
credentials then sat in the address bar, browser history and any access log.

## Fix

1. The form is now `<form method="post" action="/api/auth/login-fallback">`.
   - Hydrated: unchanged — `onSubmit` prevents default and NextAuth's
     `signIn()` sends the credentials over a fetch POST body.
   - Pre-hydration: the native submit is a POST to a dedicated route; named
     fields go in the request body, never the query string.
2. `POST /api/auth/login-fallback` **never reads, logs or reflects the body**.
   It answers `303 → /login?js=1`, so the browser lands on a clean URL with a
   "JavaScript is required" notice (`<noscript>`).
3. `src/app/(auth)/login/page.tsx` strips leaked credentials server-side: if
   the URL carries `email` or `password`, it redirects to `/login` with only
   the allowed params (`callbackUrl`, `sessionExpired`, `js`) from
   `sanitizeLoginQuery()`.
4. `safeCallbackUrl()` (shared by the page and form) rejects callback URLs that
   carry `email`/`password` query params in addition to the existing
   foreign/protocol-relative/API-path guards, so a post-login redirect can
   never preserve them.
5. Inputs keep `autoComplete="email"` / `autoComplete="current-password"` so the
   password manager fills them without custom JS.

The auth success/failure semantics are untouched, and no path logs the
credentials.

## Tests

- `src/lib/auth/__tests__/login-params.test.ts` — credential stripping (string
  and Next `searchParams` forms), callback URL guard.
- `src/app/(auth)/login/__tests__/login-form-static.test.ts` — pins the form
  `method="post"`, the fallback action, the password input attributes, and that
  the fallback route never parses the body.
