'use client';

import Link from 'next/link';
import { AlertTriangle, Boxes, PackageX, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RawMaterialStatusBadge } from '@/components/raw-materials/RawMaterialStatusBadge';
import { RawMaterialAlertsPanel } from '@/components/raw-materials/RawMaterialAlertsPanel';
import { ProductionHistoryPanel } from '@/components/bom/ProductionHistoryPanel';
import { useRawMaterialStats, useRawMaterials } from '@/hooks/useRawMaterials';
import { getUnitShortLabel } from '@/lib/services/rawMaterial.core';

interface FactoryDashboardClientProps {
  permissions: string[];
}

export function FactoryDashboardClient({ permissions }: FactoryDashboardClientProps) {
  const { data: statsData } = useRawMaterialStats();
  const { data: lowStockData } = useRawMaterials({ stockStatus: 'LOW', limit: 5 });

  const stats = statsData?.data;
  const lowStock = lowStockData?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Factory Dashboard</h1>
        <p className="mt-1 font-body text-sm text-mist">
          Monitor bulk raw-material stock for production planning.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist">Total materials</CardTitle>
            <Boxes className="h-4 w-4 text-mist" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-espresso">{stats?.totalMaterials ?? '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist">Low stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.lowStockCount ?? '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mist">Out of stock</CardTitle>
            <PackageX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.outOfStockCount ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RawMaterialAlertsPanel permissions={permissions} />
        {permissions.includes('bom:view') && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-espresso">
                <FlaskConical className="h-4 w-4 text-mist" />
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
        {lowStock.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mist">
            No materials are currently low on stock.
          </p>
        ) : (
          <ul className="divide-y">
            {lowStock.map((material) => (
              <li key={material.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-espresso">{material.name}</p>
                  <p className="text-xs text-mist">
                    {material.quantity} {getUnitShortLabel(material.unit)} on hand
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
