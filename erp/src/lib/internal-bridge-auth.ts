/**
 * Shared authentication for the Edge→Node bridge (`/api/internal/middleware`).
 *
 * The proxy runs on the Edge runtime and cannot use Prisma, so it calls this
 * bridge over `fetch`. That makes the bridge a **publicly reachable HTTP
 * endpoint** whose unauthenticated path writes audit rows and reads user/tenant
 * state, so it should verify its caller.
 *
 * Enforcement model (deliberately explicit rather than "on"):
 *  - Secret CONFIGURED  → every request must present the matching value,
 *    compared in constant time. This is the intended production state.
 *  - Secret MISSING + production → refuse everything (fail closed). A
 *    misconfigured deployment becomes a visibly broken proxy, not a silent open
 *    database bridge.
 *  - Secret MISSING + development → allow, but report it. Local dev and the
 *    Playwright gate run without a secret by design; blocking would break them
 *    for no security gain on a loopback-only server.
 *
 * Set `INTERNAL_BRIDGE_SECRET=<value>` to activate enforcement in both the proxy
 * (which reads `buildBridgeAuthHeaders()`) and this bridge at once.
 */
import { timingSafeEqual } from 'crypto';

// Re-exported so the Node bridge route has a single import site, while
// `proxy.ts` imports the header module directly (Edge has no `crypto` module).
export { INTERNAL_BRIDGE_HEADER, buildBridgeAuthHeaders } from '@/lib/internal-bridge-headers';

export type BridgeAuthStatus = 'enforced' | 'dev-unprotected' | 'production-unprotected';

/** True when the deployment has configured the bridge secret. */
export function isBridgeSecretConfigured(): boolean {
  return Boolean(process.env.INTERNAL_BRIDGE_SECRET);
}

/** Current enforcement state, for health reporting and tests. */
export function getBridgeAuthStatus(): BridgeAuthStatus {
  if (isBridgeSecretConfigured()) return 'enforced';
  return process.env.NODE_ENV === 'production' ? 'production-unprotected' : 'dev-unprotected';
}

/**
 * Constant-time comparison of a presented secret against the configured one.
 * Returns false when either side is missing — never throws.
 */
export function isValidBridgeSecret(presented: string | null | undefined): boolean {
  const expected = process.env.INTERNAL_BRIDGE_SECRET;
  if (!expected || !presented) return false;

  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(presented, 'utf-8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Decide whether a bridge request may proceed.
 *
 * Returns `{ allowed: true }` only when the caller is authenticated, or when the
 * deployment is an unconfigured non-production environment (see the module note).
 * Any refusal carries a machine-readable reason for logs and tests.
 */
export function authorizeBridgeRequest(
  presented: string | null | undefined,
): { allowed: boolean; reason?: 'BAD_SECRET' | 'SECRET_NOT_CONFIGURED' } {
  if (isBridgeSecretConfigured()) {
    return isValidBridgeSecret(presented)
      ? { allowed: true }
      : { allowed: false, reason: 'BAD_SECRET' };
  }

  if (process.env.NODE_ENV === 'production') {
    return { allowed: false, reason: 'SECRET_NOT_CONFIGURED' };
  }

  return { allowed: true };
}