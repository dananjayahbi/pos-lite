'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RAW_MATERIAL_ADJUSTMENT_REASON_LABELS,
  type RawMaterialAdjustmentHistoryItem,
} from '@/lib/services/rawMaterialAdjustment.core';

interface RawMaterialHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: { id: string; name: string; unitShortLabel: string } | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDelta(value: string | null): string {
  if (value === null) return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric > 0 ? `+${value}` : value;
}

/**
 * ARGUS #246: per-material adjustment history, projected from the
 * RAW_MATERIAL_STOCK_ADJUSTED audit rows (raw materials have no movement table).
 */
export function RawMaterialHistoryDialog({
  open,
  onOpenChange,
  material,
}: RawMaterialHistoryDialogProps) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    success: boolean;
    data: { items: RawMaterialAdjustmentHistoryItem[] };
  }>({
    queryKey: ['raw-material-adjustments', material?.id],
    enabled: open && material !== null,
    queryFn: async () => {
      const res = await fetch(`/api/store/raw-materials/${material?.id}/adjustments`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to load adjustment history');
      }
      return json;
    },
  });

  if (!material) return null;
  const items = data?.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjustment history - {material.name}</DialogTitle>
          <DialogDescription>
            Stock changes recorded with a reason, newest first.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Could not load adjustment history.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Retrying...' : 'Retry'}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist-ink">
            No adjustments recorded for this material yet.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-mist-ink">
                      {formatDate(item.createdAt)}
                    </TableCell>
                    <TableCell>
                      {item.reason
                        ? RAW_MATERIAL_ADJUSTMENT_REASON_LABELS[item.reason]
                        : (item.reasonText ?? 'Unspecified')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatDelta(item.quantityDelta)} {material.unitShortLabel}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quantityBefore ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quantityAfter ?? '-'}
                    </TableCell>
                    <TableCell className="text-mist-ink">{item.actorName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
