import type { NextRequest } from 'next/server';

interface RequestLike {
  headers: Headers;
}

function normalizeFirstForwardedIp(value: string): string {
  const [first] = value.split(',');
  return first?.trim() || 'unknown';
}

export function getClientIp(request: RequestLike | NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return normalizeFirstForwardedIp(forwarded);
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cloudflareIp = request.headers.get('cf-connecting-ip');
  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  return 'unknown';
}
