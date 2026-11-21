import { describe, expect, it } from 'vitest';

import { resolveWebsiteLoadResult } from '@/lib/website/load-state';

/**
 * ARGUS #495: a failed GET and a tenant with no config must be distinguishable
 * from a loaded config, so the CMS cannot fall back to another tenant's demo
 * content and save it.
 */
describe('resolveWebsiteLoadResult', () => {
  it('returns ready with the loaded config', () => {
    const result = resolveWebsiteLoadResult({
      ok: true,
      status: 200,
      body: { success: true, data: { siteName: 'Lanka Electronics' } },
    });
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready') expect(result.data.siteName).toBe('Lanka Electronics');
  });

  it('returns empty when the tenant has no config', () => {
    const result = resolveWebsiteLoadResult({
      ok: true,
      status: 200,
      body: { success: true, data: null },
    });
    expect(result.kind).toBe('empty');
  });

  it('returns an error for a 500 instead of defaults', () => {
    const result = resolveWebsiteLoadResult({
      ok: false,
      status: 500,
      body: { success: false, error: { message: 'An unexpected error occurred' } },
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toContain('unexpected');
  });

  it('returns an error for an invalid/unsuccessful body', () => {
    expect(resolveWebsiteLoadResult({ ok: true, status: 200, body: null }).kind).toBe('error');
    expect(
      resolveWebsiteLoadResult({ ok: true, status: 200, body: { success: false } }).kind,
    ).toBe('error');
  });

  it('names the HTTP status when the failure body is empty', () => {
    const result = resolveWebsiteLoadResult({ ok: false, status: 503, body: null });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toContain('503');
  });
});
