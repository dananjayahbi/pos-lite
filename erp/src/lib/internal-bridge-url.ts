/**
 * Edge-safe resolver for the internal bridge URL.
 *
 * `proxy.ts` runs on the Edge Runtime and reaches the database only through
 * `/api/internal/middleware` (Node Runtime). It therefore has to call *itself*
 * over HTTP — and deriving that URL from `request.url` is wrong whenever the
 * incoming request's origin is not the origin the server is actually listening
 * on.
 *
 * Concrete failure (VS Code dev tunnel, 2026-10-30): the tunnel forwards to
 * `localhost:3003` with `Host: localhost:3003` and `x-forwarded-proto: https`,
 * so Next reconstructs `request.url` as **https**://localhost:3003. The bridge
 * `fetch` then spoke TLS to a plain-HTTP dev server:
 *
 *   ERR_SSL_PACKET_LENGTH_TOO_LONG (tls_get_more_records: packet length too long)
 *
 * The sessionVersion gate is fail-closed, so every authenticated request was
 * denied and users were bounced to /login?sessionExpired=true.
 *
 * Resolution order:
 *   1. `INTERNAL_BRIDGE_ORIGIN` — explicit escape hatch (tunnels, Docker,
 *      non-standard ports, split-origin deployments).
 *   2. production — the request origin. Serverless deployments serve the
 *      bridge from the same origin the request arrived on (and Edge→Node
 *      fetches stay inside the platform).
 *   3. development — plain-HTTP loopback on the port the request landed on.
 *      Self-calls never leave the machine, so a proxied/tunnelled request
 *      cannot poison the transport with a foreign protocol or host.
 *
 * Pure `process.env` reads and no Node builtins: safe for the Edge bundle.
 * Kept dependency-free so `__tests__` can exercise it directly.
 */

export const BRIDGE_PATH = '/api/internal/middleware';

/** Port the ERP dev server listens on (`yarn dev` → `next dev -p 3003`). */
const DEFAULT_DEV_PORT = '3003';

export interface BridgeUrlEnv {
  INTERNAL_BRIDGE_ORIGIN?: string;
  PORT?: string;
  NODE_ENV?: string;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Absolute URL of the bridge endpoint for the given incoming request.
 *
 * `requestUrl` may be any absolute URL — only its port (and, in production,
 * its origin) is used.
 */
export function resolveInternalBridgeUrl(
  requestUrl: string,
  env: BridgeUrlEnv = process.env as BridgeUrlEnv,
): URL {
  const override = env.INTERNAL_BRIDGE_ORIGIN?.trim();
  if (override) {
    return new URL(`${trimTrailingSlashes(override)}${BRIDGE_PATH}`);
  }

  const requestOrigin = new URL(requestUrl);
  if (env.NODE_ENV === 'production') {
    return new URL(BRIDGE_PATH, requestOrigin.origin);
  }

  // Dev: always loopback + plain HTTP. The request's protocol/host describe how
  // the *browser* reached us (possibly via a tunnel), not how to reach the
  // local Node process.
  const port = requestOrigin.port || env.PORT?.trim() || DEFAULT_DEV_PORT;
  return new URL(`http://127.0.0.1:${port}${BRIDGE_PATH}`);
}
