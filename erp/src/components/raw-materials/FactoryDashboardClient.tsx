'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  Coins,
  Factory,
  FlaskConical,
  PackageCheck,
  PackageX,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RawMaterialStatusBadge } from '@/components/raw-materials/RawMaterialStatusBadge';
import { RawMaterialAlertsPanel } from '@/components/raw-materials/RawMaterialAlertsPanel';
import { ProductionHistoryPanel } from '@/components/bom/ProductionHistoryPanel';
import { useRawMaterialStats } from '@/hooks/useRawMaterials';
import { useRawMaterialAlerts } from '@/hooks/useRawMaterialAlerts';
import { useFactoryStats } from '@/hooks/useFactoryStats';
import { formatRupee } from '@/lib/format';
import {
  FACTORY_REFRESH_INTERVAL_MS,
  FACTORY_REFRESH_TICK_MS,
  formatFactoryLastUpdated,
  isFactoryRefreshDue,
  latestUpdatedAt,
  refetchFactoryDashboard,
} from '@/lib/factory/factoryRefresh';
import {
  buildFactoryStockPopulation,
  factoryAlertStockStatus,
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
  // ARGUS #258 - the alerts feed is the one low-stock population. The same
  // query key is shared with RawMaterialAlertsPanel, so both surfaces read one
  // response (no limit/post-filter discrepancy) and the KPI/list cannot drift.
  const {
    data: alertsData,
    dataUpdatedAt: alertsUpdatedAt,
    isError: alertsIsError,
    isLoading: alertsIsLoading,
    error: alertsError,
    isFetching: alertsIsFetching,
    refetch: refetchAlerts,
  } = useRawMaterialAlerts();
  const {
    data: outputData,
    dataUpdatedAt: outputUpdatedAt,
    isError: outputIsError,
    isLoading: outputIsLoading,
    error: outputError,
    isFetching: outputIsFetching,
    refetch: refetchOutput,
  } = useFactoryStats();

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
    alertsUpdatedAt,
    outputUpdatedAt,
    lastRefreshCompletedAt,
  ]);

  const stats = statsData?.data;
  const output = outputData?.data;
  const stockPopulation = buildFactoryStockPopulation(alertsData?.data ?? []);

  // ARGUS #244 — resolve each feed explicitly (error → loading → empty → data)
  // so a failed request cannot masquerade as an all-clear or an empty panel.
  const statsState = resolveFactoryFeedState({
    isError: statsIsError,
    isLoading: statsIsLoading,
    itemCount: stats ? 1 : 0,
  });
  const stockState = resolveFactoryFeedState({
    isError: alertsIsError,
    isLoading: alertsIsLoading,
    itemCount: stockPopulation.flaggedCount,
  });
  const outputState = resolveFactoryFeedState({
    isError: outputIsError,
    isLoading: outputIsLoading,
    itemCount: output ? 1 : 0,
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
              {factoryKpiValue(stockState, stockPopulation.lowCount)}
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
              {factoryKpiValue(stockState, stockPopulation.outOfStockCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {outputState === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-body text-sm font-medium text-red-800">Output metrics failed</p>
              <p className="font-body text-xs text-red-600">
                {factoryFeedErrorMessage(outputError, 'The production metrics could not be loaded.')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            onClick={() => refetchOutput()}
            disabled={outputIsFetching}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${outputIsFetching ? 'animate-spin' : ''}`} />
            {outputIsFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {/* ARGUS #261 - production output and finished-goods stock alongside input stock. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Production runs</CardTitle>
            <Factory className="h-4 w-4 text-mist-ink" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-espresso">
              {factoryKpiValue(outputState, output?.productionRunCount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Units produced</CardTitle>
            <FlaskConical className="h-4 w-4 text-terracotta" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-espresso">
              {factoryKpiValue(outputState, output?.totalProduced)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Finished goods</CardTitle>
            <PackageCheck className="h-4 w-4 text-mist-ink" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-espresso">
              {factoryKpiValue(outputState, output?.finishedGoodsUnits)}
            </div>
            <p className="font-body text-xs text-mist-ink">units in stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist-ink">Finished-goods value</CardTitle>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-espresso">
              {outputState === 'data' && output
                ? formatRupee(output.finishedGoodsValue)
                : '-'}
            </div>
            <p className="font-body text-xs text-mist-ink">at recorded cost</p>
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
              <div className="flex items-center gap-1">
                {permissions.includes('bom:production:view') && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/factory/production">View all</Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/factory/bom">Manage BOMs</Link>
                </Button>
              </div>
            </div>
            <div className="p-4">
              <ProductionHistoryPanel compact />
            </div>
          </div>
        )}
      </div>

      <div id="low-stock-materials" className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-espresso">
              Low stock materials
            </h2>
            <p className="font-body text-xs text-mist-ink">
              {stockState === 'data'
                ? `${stockPopulation.lowCount} low, ${stockPopulation.outOfStockCount} out of stock`
                : 'One list shared with the alert summary and KPI cards.'}
            </p>
          </div>
          {permissions.includes('raw_material:view') && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/factory/raw-materials">View all</Link>
            </Button>
          )}
        </div>
        {stockState === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 px-4 py-8 text-center"
          >
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="font-body text-sm font-medium text-red-800">Low-stock list failed</p>
            <p className="font-body text-xs text-red-600">
              {factoryFeedErrorMessage(
                alertsError,
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
              onClick={() => refetchAlerts()}
              disabled={alertsIsFetching}
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${alertsIsFetching ? 'animate-spin' : ''}`}
              />
              {alertsIsFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : stockState === 'loading' ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : stockState === 'empty' ? (
          <p className="px-4 py-8 text-center text-sm text-mist-ink">
            No materials are currently low on stock.
          </p>
        ) : (
          <ul className="divide-y">
            {stockPopulation.items.map((material) => (
              <li
                key={material.rawMaterialId}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-medium text-espresso">{material.name}</p>
                  <p className="text-xs text-mist-ink">
                    {material.quantity} {material.unitShortLabel} on hand · threshold{' '}
                    {material.lowStockThreshold}
                  </p>
                </div>
                <RawMaterialStatusBadge status={factoryAlertStockStatus(material.severity)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
