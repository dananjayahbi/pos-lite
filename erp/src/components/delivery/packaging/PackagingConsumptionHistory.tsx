'use client';

import { useState } from 'react';
import { History, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePackagingHistory, type PackagingItemRow } from '@/hooks/delivery';

const PAGE_SIZE = 25;

interface PackagingConsumptionHistoryProps {
  items: PackagingItemRow[];
}

/**
 * ARGUS #281: the consumption ledger behind the stock balances. Each row is one
 * `PackagingConsumption` (normally one parcel + item) with its delivery/order
 * reference, item, quantity and timestamp.
 */
export function PackagingConsumptionHistory({ items }: PackagingConsumptionHistoryProps) {
  const [itemId, setItemId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = usePackagingHistory({
    page,
    pageSize: PAGE_SIZE,
    ...(itemId === 'all' ? {} : { itemId }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="border-mist">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <History className="h-4 w-4" />
              Consumption History
            </CardTitle>
            <CardDescription>
              Packaging deducted on dispatch, newest first. {total} recorded consumption
              {total === 1 ? '' : 's'}.
            </CardDescription>
          </div>
          <div className="w-56">
            <Select
              value={itemId}
              onValueChange={(value) => {
                setItemId(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter consumption history by item">
                <SelectValue placeholder="All items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="border-terracotta/30 bg-terracotta/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"
          >
            <span className="text-espresso/70">Could not load packaging consumption history.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {isFetching ? 'Retrying...' : 'Retry'}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="border-espresso/20 text-espresso/50 rounded-lg border border-dashed py-8 text-center text-sm">
            No packaging consumption recorded yet.
          </div>
        ) : (
          <div className="border-espresso/10 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-150">
              <thead>
                <tr className="border-espresso/10 bg-espresso/5 border-b">
                  <th className="text-espresso/60 px-3 py-2 text-left text-xs font-medium">When</th>
                  <th className="text-espresso/60 px-3 py-2 text-left text-xs font-medium">
                    Order / Delivery
                  </th>
                  <th className="text-espresso/60 px-3 py-2 text-left text-xs font-medium">Item</th>
                  <th className="text-espresso/60 px-3 py-2 text-right text-xs font-medium">
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-espresso/5 hover:bg-espresso/5 border-b last:border-0"
                  >
                    <td className="text-espresso/70 px-3 py-2 text-sm">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-espresso font-mono text-xs">{row.reference}</div>
                      {row.saleId ? (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          Sale linked
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-espresso text-sm">{row.itemName}</div>
                      {row.itemSku ? (
                        <div className="text-espresso/50 font-mono text-xs">{row.itemSku}</div>
                      ) : null}
                    </td>
                    <td className="text-espresso px-3 py-2 text-right text-sm font-medium">
                      {row.quantityLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-espresso/60">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
