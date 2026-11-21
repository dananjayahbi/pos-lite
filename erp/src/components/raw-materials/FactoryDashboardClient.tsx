'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackageX, FlaskConical, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RawMaterialStatusBadge } from '@/components/raw-materials/RawMaterialStatusBadge';
import { RawMaterialAlertsPanel } from '@/components/raw-materials/RawMaterialAlertsPanel';
import { ProductionHistoryPanel } from '@/components/bom/ProductionHistoryPanel';
import { useRawMaterialStats, useRawMaterials } from '@/hooks/useRawMaterials';
import {
  FACTORY_REFRESH_INTERVAL_MS,
  FACTORY_REFRESH_TICK_MS,
  formatFactoryLastUpdated,
  isFactoryRefreshDue,
  latestUpdatedAt,
  refetchFactoryDashboard,
} from '@/lib/factory/factoryRefresh';
import {
  factoryFeedErrorMessage,
  factoryKpiValue,
  resolveFactoryFeedState,
} from '@/components/raw-materials/factoryDashboardState';

interface FactoryDashboardClientProps {
  permissions: string[];
}

export function FactoryDashboardClient({ permissions }: FactoryDashboardClientProps) {
  const queryClient = useQueryClient();
  const {
    data: statsData,
    dataUpdatedAt: statsUpdatedAt,
    isError: statsIsError,
    isLoading: statsIsLoading,
    error: statsError,
    isFetching: statsIsFetching,
    refetch: refetchStats,
  } = useRawMaterialStats();
  const {
    data: lowStockData,
    dataUpdatedAt: lowStockUpdatedAt,
    isError: lowStockIsError,
    isLoading: lowStockIsLoading,
    error: lowStockError,
    isFetching: lowStockIsFetching,
    refetch: refetchLowStock,
  } = useRawMaterials({ stockStatus: 'LOW', limit: 5 });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshCompletedAt, setLastRefreshCompletedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const refreshingRef = useRef(false);
  // Set on mount (inside the effect) so the first automatic refresh happens one
  // full interval after the initial query load, not on the first tick.
  const lastRefreshStartedAtRef = useRef<number | null>(null);

  // ARGUS #257 - one refresh moves all four dashboard feeds together. The
  // button and the timer share the same guard, so refetches never overlap and
  // existing data stays visible while the refresh runs.
  const refreshAll = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    lastRefreshStartedAtRef.current = Date.now();
    setIsRefreshing(true);
    try {
      await refetchFactoryDashboard(queryClient);
      setLastRefreshCompletedAt(Date.now());
      setNow(Date.now());
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (lastRefreshStartedAtRef.current === null) {
      lastRefreshStartedAtRef.current = Date.now();
    }
    const timer = window.setInterval(() => {
      const tickNow = Date.now();
      setNow(tickNow);
      if (
        isFactoryRefreshDue({
          now: tickNow,
          lastRunAt: lastRefreshStartedAtRef.current,
          isVisible: document.visibilityState === 'visible',
          isRefreshing: refreshingRef.current,
        })
      ) {
        void refreshAll();
      }
    }, FACTORY_REFRESH_TICK_MS);
    return () => window.clearInterval(timer);
  }, [refreshAll]);

  const lastUpdatedAt = latestUpdatedAt([
    statsUpdatedAt,
    lowStockUpdatedAt,
    lastRefreshCompletedAt,
  ]);

  const stats = statsData?.data;
  const lowStock = lowStockData?.data ?? [];

  // ARGUS #244 — resolve each feed explicitly (error → loading → empty → data)
  // so a failed request cannot masquerade as an all-clear or an empty panel.
  const statsState = resolveFactoryFeedState({
    isError: statsIsError,
    isLoading: statsIsLoading,
    itemCount: stats ? 1 : 0,
  });
  const lowStockState = resolveFactoryFeedState({
    isError: lowStockIsError,
    isLoading: lowStockIsLoading,
    itemCount: lowStock.length,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Factory Dashboard</h1>
          <p className="mt-1 font-body text-sm text-mist-ink">
            Monitor bulk raw-material stock for production planning.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-body text-xs text-mist-ink"
            title={lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : undefined}
          >
            Last updated {formatFactoryLastUpdated(lastUpdatedAt, now)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshAll()}
            disabled={isRefreshing}
            title={`Auto-refreshes every ${Math.round(FACTORY_REFRESH_INTERVAL_MS / 1000)} seconds`}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {statsState === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-body text-sm font-medium text-red-800">Factory metrics failed</p>
              <p className="font-body text-xs text-red-600">
                {factoryFeedErrorMessage(statsError, 'The factory metrics could not be loaded.')}
              </p>
              <p className="font-body text-xs text-red-600">
                KPI values are neutral until the feed loads.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            onClick={() => refetchStats()}
            disabled={statsIsFetching}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${statsIsFetching ? 'animate-spin' : ''}`} />
            {statsIsFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Total materials</CardTitle>
            <Boxes className="h-4 w-4 text-mist-ink" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-espresso">
              {factoryKpiValue(statsState, stats?.totalMaterials)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Low stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {factoryKpiValue(statsState, stats?.lowStockCount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Out of stock</CardTitle>
            <PackageX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {factoryKpiValue(statsState, stats?.outOfStockCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RawMaterialAlertsPanel permissions={permissions} />
        {permissions.includes('bom:view') && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-espresso">
                <FlaskConical className="h-4 w-4 text-mist-ink" />
                Production
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/factory/bom">Manage BOMs</Link>
              </Button>
            </div>
            <div className="p-4">
              <ProductionHistoryPanel compact />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-espresso">Low stock materials</h2>
          {permissions.includes('raw_material:view') && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/factory/raw-materials">View all</Link>
            </Button>
          )}
        </div>
        {lowStockState === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 px-4 py-8 text-center"
          >
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="font-body text-sm font-medium text-red-800">Low-stock list failed</p>
            <p className="font-body text-xs text-red-600">
              {factoryFeedErrorMessage(
                lowStockError,
                'The low-stock materials could not be loaded.',
              )}
            </p>
            <p className="font-body text-xs text-red-600">
              The low-stock status is unknown until the list loads.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 bg-white text-red-700 hover:bg-red-100"
              onClick={() => refetchLowStock()}
              disabled={lowStockIsFetching}
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${lowStockIsFetching ? 'animate-spin' : ''}`}
              />
              {lowStockIsFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : lowStockState === 'loading' ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : lowStockState === 'empty' ? (
          <p className="px-4 py-8 text-center text-sm text-mist-ink">
            No materials are currently low on stock.
          </p>
        ) : (
          <ul className="divide-y">
            {lowStock.map((material) => (
              <li key={material.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-espresso">{material.name}</p>
                  <p className="text-xs text-mist-ink">
                    {material.quantity} {material.unitShortLabel} on hand
                  </p>
                </div>
                <RawMaterialStatusBadge status={material.stockStatus} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
