import type { QueryClient } from '@tanstack/react-query';

/**
 * ARGUS #256 - one source of truth for the React Query keys a raw-material
 * mutation must refresh.
 *
 * The list and stats keys were invalidated by create/edit/delete/adjust, but
 * the alerts key was not, so the Low-stock KPI/list refreshed while the Raw
 * material alerts panel stayed stale for up to its 20s cache. Production
 * (`useProduceGoods`) already invalidated all three.
 */
export const RAW_MATERIAL_SURFACE_QUERY_KEYS = [
  ['raw-materials'],
  ['raw-material-stats'],
  ['raw-material-alerts'],
] as const;

/**
 * Everything the Factory Dashboard reads. Used by the periodic/manual refresh
 * so the KPIs, low-stock list, alerts and production feed move together.
 */
export const FACTORY_DASHBOARD_QUERY_KEYS = [
  ['raw-material-stats'],
  ['raw-materials'],
  ['raw-material-alerts'],
  ['production-logs'],
  // ARGUS #261 - production/finished-goods KPIs refresh with the input KPIs.
  ['factory-output-stats'],
] as const;

/** The key prefixes invalidated after any raw-material mutation. */
export function rawMaterialSurfaceQueryKeys(): readonly (readonly string[])[] {
  return RAW_MATERIAL_SURFACE_QUERY_KEYS;
}

/**
 * Invalidate every surface derived from raw-material stock in one call. Safe to
 * call without awaiting from an `onSuccess` callback.
 */
export async function invalidateRawMaterialSurfaces(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    RAW_MATERIAL_SURFACE_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
