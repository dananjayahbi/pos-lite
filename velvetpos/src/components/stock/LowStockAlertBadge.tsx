'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLowStockCount } from '@/hooks/useLowStockCount';

export function LowStockAlertBadge() {
  const { data, isLoading } = useLowStockCount();
  const count = data?.data?.count ?? 0;

  if (isLoading) {
    return <Skeleton className="h-11 w-72 rounded-lg" />;
  }

  if (count === 0) {
    return null;
  }

  return (
    <Link
      href="/stock-control/low-stock"
      className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 transition-colors hover:bg-amber-100"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
      <span className="flex-1 font-body text-sm font-medium text-amber-800">
        {count} {count === 1 ? 'variant' : 'variants'} low on stock
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
    </Link>
  );
}
