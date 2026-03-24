'use client';

import Link from 'next/link';
import { useRecentMovements } from '@/hooks/useRecentMovements';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })} · ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function RecentStockMovementsCard() {
  const { data, isLoading } = useRecentMovements();
  const movements = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-espresso">Recent Stock Movements</CardTitle>
          <p className="mt-1 text-sm text-sand">Latest stock adjustments, receipts, and returns.</p>
        </div>
        <Link href="/stock-control/movements" className="text-xs text-terracotta hover:underline">
          View audit →
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              : movements.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-sand">
                        No stock movements recorded yet.
                      </TableCell>
                    </TableRow>
                  )
                : movements.map((movement) => {
                    const badge = REASON_BADGE[movement.reason] ?? {
                      label: movement.reason,
                      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
                    };
                    const positive = movement.quantityDelta > 0;

                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="text-sm text-espresso">{formatDateTime(movement.createdAt)}</TableCell>
                        <TableCell className="font-mono text-sm">{movement.variant.sku}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={positive ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                            {positive ? `+${movement.quantityDelta}` : movement.quantityDelta}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-sand">{movement.actor.email}</TableCell>
                      </TableRow>
                    );
                  })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
