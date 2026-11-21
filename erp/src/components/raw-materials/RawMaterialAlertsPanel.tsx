'use client';

import Link from 'next/link';
import { AlertTriangle, PackageX, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRawMaterialAlerts } from '@/hooks/useRawMaterialAlerts';
import {
  factoryFeedErrorMessage,
  resolveFactoryFeedState,
} from '@/components/raw-materials/factoryDashboardState';

interface RawMaterialAlertsPanelProps {
  permissions: string[];
}

export function RawMaterialAlertsPanel({ permissions }: RawMaterialAlertsPanelProps) {
  const { data, isError, isLoading, error, isFetching, refetch } = useRawMaterialAlerts();
  const alerts = data?.data ?? [];

  // ARGUS #244 — error first: a failed alerts call must never print the green
  // "all raw materials are above their thresholds" all-clear.
  const viewState = resolveFactoryFeedState({
    isError,
    isLoading,
    itemCount: alerts.length,
  });

  const critical = alerts.filter((a) => a.severity === 'CRITICAL');
  const low = alerts.filter((a) => a.severity === 'LOW');

  const canViewMaterials = permissions.includes('raw_material:view');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-mist-ink">Raw material alerts</CardTitle>
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        {viewState === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-5 text-center"
          >
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="font-body text-sm font-medium text-red-800">Alerts check failed</p>
            <p className="font-body text-xs text-red-600">
              {factoryFeedErrorMessage(error, 'The raw material alerts could not be loaded.')}
            </p>
            <p className="font-body text-xs text-red-600">
              Stock alerts are unknown until the feed loads.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 bg-white text-red-700 hover:bg-red-100"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : viewState === 'loading' ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : viewState === 'empty' ? (
          <p className="py-2 text-sm text-mist-ink">
            All raw materials are above their low-stock thresholds.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span className="text-red-600">
                <PackageX className="mr-1 inline h-3.5 w-3.5" />
                {critical.length} critical
              </span>
              <span className="text-amber-600">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                {low.length} low
              </span>
            </div>
            <ul className="divide-y">
              {alerts.slice(0, 6).map((alert) => (
                <li key={alert.rawMaterialId} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-espresso">{alert.name}</p>
                    <p className="text-xs text-mist-ink">
                      {alert.quantity} {alert.unitShortLabel} on hand · threshold{' '}
                      {alert.lowStockThreshold}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {alert.severity === 'CRITICAL' ? 'Out' : 'Low'}
                  </span>
                </li>
              ))}
            </ul>
            {canViewMaterials && (
              <Button variant="ghost" size="sm" asChild className="mt-1">
                <Link href="/factory/raw-materials">View materials</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
