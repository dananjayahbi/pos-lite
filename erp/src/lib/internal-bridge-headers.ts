/**
 * Edge-safe half of the internal-bridge auth contract.
 *
 * `proxy.ts` runs on the Edge runtime, so the pieces it needs must NOT import
 * Node builtins. This module therefore carries only the header name and the
 * header builder (both pure `process.env` reads), while the timing-safe
 * comparison lives in `internal-bridge-auth.ts` (Node-only, used by the bridge
 * route). Splitting them keeps `crypto`'s `timingSafeEqual` off the Edge bundle.
 */

/** Header the proxy presents on every bridge call. */
export const INTERNAL_BRIDGE_HEADER = 'x-internal-bridge-secret';

/**
 * The headers the proxy must send with every bridge call. Empty when
 * `INTERNAL_BRIDGE_SECRET` is unconfigured — which, in production, means the
 * bridge refuses the call (fail closed) rather than trusting it.
 */
export function buildBridgeAuthHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_BRIDGE_SECRET;
  return secret ? { [INTERNAL_BRIDGE_HEADER]: secret } : {};
}