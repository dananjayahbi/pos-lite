import { NextResponse } from 'next/server';

/**
 * POST target for the login form before React hydrates (ARGUS #39).
 *
 * A hydrated form never reaches this route — `onSubmit` calls
 * `preventDefault` and NextAuth's `signIn` posts over fetch. This exists only
 * so the un-hydrated native submit is a POST (credentials in the request body,
 * never the query string). The body is deliberately never read, logged or
 * reflected; the caller is sent back to a clean login URL with a hint that
 * JavaScript is required.
 */
export async function POST(request: Request) {
  return NextResponse.redirect(new URL('/login?js=1', request.url), {
    status: 303,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** A GET here has no business carrying anything; send it to a clean login. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/login', request.url), {
    status: 307,
    headers: { 'Cache-Control': 'no-store' },
  });
}
