import { describe, expect, it } from 'vitest';

import { BRIDGE_PATH, resolveInternalBridgeUrl } from '@/lib/internal-bridge-url';

/**
 * Regression pins for the dev-tunnel outage (2026-10-30).
 *
 * The tunnel forwards with `Host: localhost:3003` + `x-forwarded-proto: https`,
 * so Next hands the Edge proxy `https://localhost:3003/...`. Building the bridge
 * URL from `request.url` made the proxy speak TLS to a plain-HTTP server:
 * `ERR_SSL_PACKET_LENGTH_TOO_LONG`, which the fail-closed session gate turned
 * into `/login?sessionExpired=true` on every authenticated request.
 */
describe('resolveInternalBridgeUrl (development)', () => {
  const dev = { NODE_ENV: 'development' } as const;

  it('uses plain-HTTP loopback, never the tunnelled https origin', () => {
    const url = resolveInternalBridgeUrl('https://localhost:3003/dashboard', dev);
    expect(url.protocol).toBe('http:');
    expect(url.host).toBe('127.0.0.1:3003');
    expect(url.pathname).toBe(BRIDGE_PATH);
  });

  it('keeps the port the request landed on', () => {
    const url = resolveInternalBridgeUrl('http://localhost:3100/pos', dev);
    expect(url.port).toBe('3100');
  });

  it('falls back to the configured PORT when the request carries none', () => {
    const url = resolveInternalBridgeUrl('https://localhost/dashboard', {
      NODE_ENV: 'development',
      PORT: '4000',
    });
    expect(url.host).toBe('127.0.0.1:4000');
  });

  it('ignores a foreign public host entirely', () => {
    const url = resolveInternalBridgeUrl(
      'https://1hnns666-3003.use.devtunnels.ms/api/notifications',
      dev,
    );
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.search).toBe('');
  });
});

describe('resolveInternalBridgeUrl (production)', () => {
  it('stays on the request origin so Edge→Node fetches do not leave the deployment', () => {
    const url = resolveInternalBridgeUrl(
      'https://erp.example.com/dashboard',
      { NODE_ENV: 'production' },
    );
    expect(url.toString()).toBe(`https://erp.example.com${BRIDGE_PATH}`);
  });
});

describe('resolveInternalBridgeUrl (INTERNAL_BRIDGE_ORIGIN override)', () => {
  it('honours an explicit origin and strips trailing slashes', () => {
    const url = resolveInternalBridgeUrl('https://anything.test/x', {
      NODE_ENV: 'production',
      INTERNAL_BRIDGE_ORIGIN: 'http://bridge.internal:8080//',
    });
    expect(url.toString()).toBe(`http://bridge.internal:8080${BRIDGE_PATH}`);
  });

  it('takes precedence over the production request origin', () => {
    const url = resolveInternalBridgeUrl('https://erp.example.com/x', {
      NODE_ENV: 'production',
      INTERNAL_BRIDGE_ORIGIN: 'http://127.0.0.1:3003',
    });
    expect(url.host).toBe('127.0.0.1:3003');
  });
});
