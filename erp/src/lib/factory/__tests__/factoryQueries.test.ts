import { describe, expect, it } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  FACTORY_DASHBOARD_QUERY_KEYS,
  invalidateRawMaterialSurfaces,
  RAW_MATERIAL_SURFACE_QUERY_KEYS,
  rawMaterialSurfaceQueryKeys,
} from '@/lib/factory/factoryQueries';

describe('factoryQueries - raw material surfaces (ARGUS #256)', () => {
  it('invalidates the list, stats and alerts keys', () => {
    expect(rawMaterialSurfaceQueryKeys()).toEqual([
      ['raw-materials'],
      ['raw-material-stats'],
      ['raw-material-alerts'],
    ]);
  });

  it('includes the alerts key that used to be missed', () => {
    expect(RAW_MATERIAL_SURFACE_QUERY_KEYS).toContainEqual(['raw-material-alerts']);
  });

  it('does not touch the production feed on a raw-material mutation', () => {
    expect(RAW_MATERIAL_SURFACE_QUERY_KEYS).not.toContainEqual(['production-logs']);
  });

  it('calls invalidateQueries once per surface key', async () => {
    const seen: unknown[] = [];
    const fakeClient = {
      invalidateQueries: async (options: { queryKey: readonly string[] }) => {
        seen.push(options.queryKey);
      },
    } as unknown as QueryClient;

    await invalidateRawMaterialSurfaces(fakeClient);

    expect(seen).toEqual([
      ['raw-materials'],
      ['raw-material-stats'],
      ['raw-material-alerts'],
    ]);
  });
});

describe('factoryQueries - dashboard refresh keys (ARGUS #257)', () => {
  it('covers stats, the raw-material lists, alerts, production and output KPIs', () => {
    expect(FACTORY_DASHBOARD_QUERY_KEYS).toEqual([
      ['raw-material-stats'],
      ['raw-materials'],
      ['raw-material-alerts'],
      ['production-logs'],
      ['factory-output-stats'],
    ]);
  });
});
