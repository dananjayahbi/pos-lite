import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  authorizeBridgeRequest,
  getBridgeAuthStatus,
  isBridgeSecretConfigured,
  isValidBridgeSecret,
} from '@/lib/internal-bridge-auth';
import { buildBridgeAuthHeaders } from '@/lib/internal-bridge-headers';

/**
 * M35-02 hardening — the Edge→Node bridge authentication contract.
 *
 * The bridge is a publicly reachable endpoint whose unauthenticated path writes
 * audit rows, so the enforcement rules are asserted directly rather than left to
 * a deployment convention.
 */
const SECRET = 'bridge-secret-0123456789';

const ORIGINAL_SECRET = process.env.INTERNAL_BRIDGE_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/**
 * TS declares `process.env.NODE_ENV` readonly, and Vitest replaces `process.env`
 * between files — so write through `process.env` directly via a mutable view
 * rather than caching a module-level alias that can go stale.
 */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

beforeEach(() => {
  delete process.env.INTERNAL_BRIDGE_SECRET;
  setNodeEnv('development');
});

afterEach(() => {
  delete process.env.INTERNAL_BRIDGE_SECRET;
  if (ORIGINAL_SECRET !== undefined) process.env.INTERNAL_BRIDGE_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_NODE_ENV !== undefined) setNodeEnv(ORIGINAL_NODE_ENV);
});

describe('isValidBridgeSecret', () => {
  it('accepts the configured secret', () => {
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(isValidBridgeSecret(SECRET)).toBe(true);
  });

  it('rejects a wrong secret of the same length', () => {
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    const wrong = SECRET.slice(0, -1) + 'X';
    expect(isValidBridgeSecret(wrong)).toBe(false);
  });

  it('rejects a wrong-length secret without throwing', () => {
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(isValidBridgeSecret('short')).toBe(false);
  });

  it('rejects null/empty presentations', () => {
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(isValidBridgeSecret(null)).toBe(false);
    expect(isValidBridgeSecret(undefined)).toBe(false);
    expect(isValidBridgeSecret('')).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(isValidBridgeSecret(SECRET)).toBe(false);
    expect(isBridgeSecretConfigured()).toBe(false);
  });
});

describe('authorizeBridgeRequest enforcement states', () => {
  it('enforces the secret when it is configured', () => {
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(authorizeBridgeRequest(SECRET)).toEqual({ allowed: true });
    expect(authorizeBridgeRequest('nope')).toEqual({ allowed: false, reason: 'BAD_SECRET' });
  });

  it('fails CLOSED in production when no secret is configured', () => {
    setNodeEnv('production');
    expect(getBridgeAuthStatus()).toBe('production-unprotected');
    expect(authorizeBridgeRequest(SECRET)).toEqual({
      allowed: false,
      reason: 'SECRET_NOT_CONFIGURED',
    });
    expect(authorizeBridgeRequest(null)).toEqual({
      allowed: false,
      reason: 'SECRET_NOT_CONFIGURED',
    });
  });

  it('allows unauthenticated calls outside production so local dev and the gate still run', () => {
    expect(getBridgeAuthStatus()).toBe('dev-unprotected');
    expect(authorizeBridgeRequest(null)).toEqual({ allowed: true });
  });

  it('reports ENFORCED once the secret is present, in any environment', () => {
    setNodeEnv('production');
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(getBridgeAuthStatus()).toBe('enforced');
  });

  it('still enforces the secret in production when it IS configured (no bypass)', () => {
    setNodeEnv('production');
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(authorizeBridgeRequest('wrong-secret-value')).toEqual({
      allowed: false,
      reason: 'BAD_SECRET',
    });
  });
});

describe('buildBridgeAuthHeaders (edge-safe module)', () => {
  it('sends the secret when configured', () => {
    process.env.INTERNAL_BRIDGE_SECRET = SECRET;
    expect(buildBridgeAuthHeaders()).toEqual({ 'x-internal-bridge-secret': SECRET });
  });

  it('sends nothing when unconfigured so production fails closed instead of bypassing', () => {
    expect(buildBridgeAuthHeaders()).toEqual({});
  });
});