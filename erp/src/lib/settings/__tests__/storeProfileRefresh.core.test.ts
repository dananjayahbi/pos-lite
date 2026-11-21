import { describe, expect, it } from 'vitest';

import {
  STORE_PROFILE_BRANDING_QUERY_KEYS,
  storeProfileRefreshPlan,
} from '@/lib/settings/storeProfileRefresh.core';

/**
 * ARGUS #488: saving Store Profile must refresh the server layout (sidebar /
 * dashboard branding) and the caches that embed branding.
 */
describe('store profile refresh plan', () => {
  it('always refreshes the server shell', () => {
    expect(storeProfileRefreshPlan().refreshShell).toBe(true);
  });

  it('invalidates the label-template cache that embeds branding', () => {
    expect(storeProfileRefreshPlan().brandingQueryKeys).toContainEqual(['label-template']);
  });

  it('exposes only concrete query-key prefixes', () => {
    for (const key of STORE_PROFILE_BRANDING_QUERY_KEYS) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.every((part) => typeof part === 'string' && part.length > 0)).toBe(true);
    }
  });

  it('does not use a broad wildcard that would refetch unrelated data', () => {
    expect(STORE_PROFILE_BRANDING_QUERY_KEYS).not.toContainEqual([]);
  });
});
