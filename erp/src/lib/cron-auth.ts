/**
 * Shared cron-route authentication. Cron endpoints are protected by a shared
 * secret (`CRON_SECRET`) presented as a `Bearer` token, compared in constant
 * time to avoid timing side-channels. Mirrors the inline helper used by the
 * other cron routes but extracted for reuse.
 */
import { timingSafeEqual } from 'crypto';

export function isValidCronSecret(authHeader: string | null): boolean {
  const envSecret = process.env.CRON_SECRET;
  if (!envSecret || !authHeader) return false;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;

  const a = Buffer.from(envSecret, 'utf-8');
  const b = Buffer.from(token, 'utf-8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
