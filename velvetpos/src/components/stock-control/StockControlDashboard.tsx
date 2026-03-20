'use client';

import Link from 'next/link';
import { PackagePlus, History, ClipboardList, Lock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStockSummary } from '@/hooks/useStockSummary';
import { useRecentMovements } from '@/hooks/useRecentMovements';
import { formatRupee } from '@/lib/format';
import { LowStockAlertBadge } from '@/components/stock/LowStockAlertBadge';

interface StockControlDashboardProps {
  permissions: string[];
}

const REASON_BADGE: Record<string, { label: string; className: string }> = {
  FOUND: { label: 'Found', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  PURCHASE_RECEIVED: { label: 'Purchase Received', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  INITIAL_STOCK: { label: 'Initial Stock', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  SALE_RETURN: { label: 'Sale Return', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  RETURNED_TO_SUPPLIER: { label: 'Returned to Supplier', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  DAMAGED: { label: 'Damaged', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  STOLEN: { label: 'Stolen', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  DATA_ERROR: { label: 'Data Error', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  STOCK_TAKE_ADJUSTMENT: { label: 'Stock Take', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function StockControlDashboard({ permissions }: StockControlDashboardProps) {
  const { data: summaryRes, isLoading: summaryLoading } = useStockSummary();
  const { data: movementsRes, isLoading: movementsLoading } = useRecentMovements();

  const summary = summaryRes?.data;
  const movements = movementsRes?.data;

  const canAdjust = permissions.includes('stock:adjust');
  const canViewStock = permissions.includes('stock:view');
  const canManageStockTakes = permissions.includes('stock:take');
  const canViewStockValue = permissions.includes('product:view_cost_price');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Stock Control</h1>
        <p className="mt-1 font-body text-sm text-mist">
          Monitor inventory levels, manage stock adjustments, and track movements.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Products */}
        <Card className="border-sand/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm font-medium text-mist">
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="font-display text-3xl font-bold text-espresso">
                {summary?.totalProducts ?? 0}
              </p>
            )}
            <p className="mt-1 font-body text-xs text-mist">Active products in catalog</p>
          </CardContent>
        </Card>

        {/* Low Stock Variants */}
        <Card className="border-sand/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm font-medium text-mist">
              Low Stock Variants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p
                className={`font-display text-3xl font-bold ${
                  (summary?.lowStockVariants ?? 0) > 0
                    ? 'text-[#B7791F]'
                    : 'text-green-600'
                }`}
              >
                {summary?.lowStockVariants ?? 0}
              </p>
            )}
            <p className="mt-1 font-body text-xs text-mist">
              Variants at or below threshold
            </p>
          </CardContent>
        </Card>

        {/* Pending Stock Takes */}
        <Card className="border-sand/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm font-medium text-mist">
              Pending Stock Takes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p
                className={`font-display text-3xl font-bold ${
                  (summary?.pendingStockTakes ?? 0) > 0
                    ? 'text-[#1D4E89]'
                    : 'text-mist'
                }`}
              >
                {summary?.pendingStockTakes ?? 0}
              </p>
            )}
            <p className="mt-1 font-body text-xs text-mist">Awaiting approval</p>
          </CardContent>
        </Card>

        {/* Total Stock Value */}
        <Card className="border-sand/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm font-medium text-mist">
              Total Stock Value (Retail)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : canViewStockValue && summary?.totalStockValue != null ? (
              <p className="font-display text-3xl font-bold text-espresso">
                {formatRupee(summary.totalStockValue)}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-mist">
                <Lock className="h-5 w-5" />
                <span className="font-body text-sm">Restricted</span>
              </div>
            )}
            <p className="mt-1 font-body text-xs text-mist">
              {canViewStockValue ? 'Based on retail prices' : 'Insufficient permissions'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert Banner */}
      {!summaryLoading && (summary?.lowStockVariants ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#B7791F]" />
          <p className="flex-1 font-body text-sm text-[#B7791F]">
            <strong>{summary?.lowStockVariants}</strong> variants are at or below their low stock
            threshold.
          </p>
          <Link
            href="/stock-control/low-stock"
            className="whitespace-nowrap font-body text-sm font-medium text-[#B7791F] underline-offset-2 hover:underline"
          >
            View Low Stock List →
          </Link>
        </div>
      )}

      {/* Low Stock Alert Badge */}
      <LowStockAlertBadge />

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-espresso">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickActionCard
            href="/stock-control/adjust"
            icon={<PackagePlus className="h-6 w-6" />}
            title="Manual Stock Adjustment"
            description="Add or remove stock with reason tracking"
            allowed={canAdjust}
          />
          <QuickActionCard
            href="/stock-control/movements"
            icon={<History className="h-6 w-6" />}
            title="Stock Movement History"
            description="View all stock changes and audit trail"
            allowed={canViewStock}
          />
          <QuickActionCard
            href="/stock-control/stock-takes"
            icon={<ClipboardList className="h-6 w-6" />}
            title="Stock Takes"
            description="Conduct and manage stock take sessions"
            allowed={canManageStockTakes}
          />
        </div>
      </div>

      {/* Recent Activity Table */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-espresso">Recent Activity</h2>
        <Card className="border-sand/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-body">Date/Time</TableHead>
                <TableHead className="font-body">SKU</TableHead>
                <TableHead className="font-body">Reason</TableHead>
                <TableHead className="font-body text-right">Delta</TableHead>
                <TableHead className="font-body">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movementsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : !movements || movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center font-body text-sm text-mist">
                    No recent stock movements
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => {
                  const badge = REASON_BADGE[m.reason] ?? {
                    label: m.reason,
                    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
                  };
                  const isPositive = m.quantityDelta > 0;

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-body text-sm text-espresso">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-espresso">
                        {m.variant.sku}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-body text-sm font-bold ${
                            isPositive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </TableCell>
                      <TableCell className="font-body text-sm text-espresso">
                        {m.actor.email}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

/* ── Quick Action Card ──────────────────────────────────────────────────── */

interface QuickActionCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  allowed: boolean;
}

function QuickActionCard({ href, icon, title, description, allowed }: QuickActionCardProps) {
  if (!allowed) {
    return (
      <Card className="relative border-sand/40 opacity-50 cursor-not-allowed">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="text-mist">{icon}</div>
          <div className="flex-1">
            <p className="font-body text-sm font-semibold text-espresso">{title}</p>
            <p className="mt-0.5 font-body text-xs text-mist">{description}</p>
          </div>
          <Lock className="h-4 w-4 text-mist" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href={href}>
      <Card className="border-sand/40 transition-all hover:bg-espresso/5 hover:shadow-md">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="text-espresso">{icon}</div>
          <div className="flex-1">
            <p className="font-body text-sm font-semibold text-espresso">{title}</p>
            <p className="mt-0.5 font-body text-xs text-mist">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
