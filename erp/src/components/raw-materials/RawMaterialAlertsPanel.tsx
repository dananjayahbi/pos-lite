'use client';

import Link from 'next/link';
import { AlertTriangle, PackageX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRawMaterialAlerts } from '@/hooks/useRawMaterialAlerts';
import { getUnitShortLabel } from '@/lib/services/rawMaterial.core';

interface RawMaterialAlertsPanelProps {
  permissions: string[];
}

export function RawMaterialAlertsPanel({ permissions }: RawMaterialAlertsPanelProps) {
  const { data } = useRawMaterialAlerts();
  const alerts = data?.data ?? [];

  const critical = alerts.filter((a) => a.severity === 'CRITICAL');
  const low = alerts.filter((a) => a.severity === 'LOW');

  const canViewMaterials = permissions.includes('raw_material:view');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-mist">Raw material alerts</CardTitle>
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="py-2 text-sm text-mist">
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
                    <p className="text-xs text-mist">
                      {alert.quantity} {getUnitShortLabel(alert.unit as 'LITERS' | 'KILOGRAMS')} on
                      hand · threshold {alert.lowStockThreshold}
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
