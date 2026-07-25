import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS helpers for the public site API.
 *
 * In production both apps sit behind the same reverse proxy and share an
 * origin, so CORS isn't strictly required. In dev (admin on :3003, site on
 * :3002) the browser will refuse cross-origin requests unless we send the
 * right headers.
 *
 * The site app's origin is exposed via the request Origin header — we echo
 * it back rather than using a static `*` so cookies / credentials would work
 * if we ever enable them. For now no credentials are sent.
 */
const STATIC_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Cache-Control',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
} as const;

export function buildCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { ...STATIC_CORS_HEADERS };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function handleCorsPreflight(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}

/**
 * Wrap a JSON body response with the CORS headers.
 */
export function jsonWithCors<T>(
  request: NextRequest,
  body: T,
  init?: ResponseInit,
): NextResponse<T> {
  const response = NextResponse.json<T>(body, init);
  const cors = buildCorsHeaders(request);
  for (const [k, v] of Object.entries(cors)) {
    response.headers.set(k, String(v));
  }
  // Cache-Control for shared CDN/browser caches
  if (!response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60');
  }
  return response;
}

/** Return a JSON error response with CORS headers attached. */
export function errorWithCors(
  request: NextRequest,
  status: number,
  message: string,
): NextResponse<{ error: string }> {
  return jsonWithCors<{ error: string }>(
    request,
    { error: message },
    { status },
  );
}