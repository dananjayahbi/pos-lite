'use client';

import Link from 'next/link';
import { AlertTriangle, Boxes, ClipboardList, Lock, Wallet } from 'lucide-react';
import { useStockSummary } from '@/hooks/useStockSummary';
import { formatRupee } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StockSummaryWidgetsProps {
  permissions: string[];
}

function SummaryCard({
  label,
  value,
  helper,
  href,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      <Card className="h-full border-mist bg-pearl transition-colors hover:border-terracotta/40">
        <CardContent className="flex h-full items-start justify-between gap-3 pt-6">
          <div>
            <p className="text-sm text-sand">{label}</p>
            <div className="mt-1 text-2xl font-bold text-espresso">{value}</div>
            <p className="mt-1 text-xs text-mist">{helper}</p>
          </div>
          <div className="rounded-lg bg-linen p-2 text-terracotta">{icon}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StockSummaryWidgets({ permissions }: StockSummaryWidgetsProps) {
  const { data, isLoading } = useStockSummary();
  const canViewValue = permissions.includes('product:view_cost_price');
  const summary = data?.data;

  const cards = [
    {
      label: 'Catalog Products',
      value: summary?.totalProducts ?? 0,
      helper: 'Active products currently tracked',
      href: '/inventory',
      icon: <Boxes className="h-5 w-5" />,
    },
    {
      label: 'Low Stock Variants',
      value: summary?.lowStockVariants ?? 0,
      helper: 'Variants already below threshold',
      href: '/stock-control/low-stock',
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    {
      label: 'Pending Stock Takes',
      value: summary?.pendingStockTakes ?? 0,
      helper: 'Counts waiting for approval',
      href: '/stock-control/stock-takes',
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      label: 'Inventory Retail Value',
      value:
        canViewValue && summary?.totalStockValue != null ? (
          formatRupee(summary.totalStockValue)
        ) : (
          <span className="inline-flex items-center gap-2 text-base font-medium text-mist">
            <Lock className="h-4 w-4" /> Restricted
          </span>
        ),
      helper: canViewValue ? 'Snapshot across active variants' : 'Requires cost-price permission',
      href: '/stock-control/valuation',
      icon: <Wallet className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))
        : cards.map((card) => <SummaryCard key={card.label} {...card} />)}
    </div>
  );
}
