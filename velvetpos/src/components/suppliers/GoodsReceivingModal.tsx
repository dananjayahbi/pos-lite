'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────────

interface POLine {
  id: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  orderedQty: number;
  receivedQty: number;
  isFullyReceived: boolean;
  expectedCostPrice: string | number;
  actualCostPrice?: string | number | null;
  variant: {
    sku: string;
    size?: string | null;
    colour?: string | null;
    costPrice: string | number;
    stockQuantity: number;
    imageUrls: string[];
    product: { name: string };
  };
}

interface PurchaseOrderDetail {
  id: string;
  status: string;
  totalAmount: string | number;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  createdAt: string;
  supplier: {
    id: string;
    name: string;
    phone: string;
    whatsappNumber?: string | null;
    contactName?: string | null;
  };
  createdBy: { id: string; email: string };
  lines: POLine[];
}

interface ReceivingEntry {
  thisQty: number;
  actualCostPrice: string;
}

interface GoodsReceivingModalProps {
  po: PurchaseOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: {
    costPricesChanged: Array<{
      variantId: string;
      oldCostPrice: string;
      newCostPrice: string;
    }>;
    costPriceChangedCount: number;
  }) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GoodsReceivingModal({
  po,
  open,
  onOpenChange,
  onSuccess,
}: GoodsReceivingModalProps) {
  const [receivingEntries, setReceivingEntries] = useState<
    Record<string, ReceivingEntry>
  >({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize entries when po.lines changes
  useEffect(() => {
    const entries: Record<string, ReceivingEntry> = {};
    for (const line of po.lines) {
      if (!line.isFullyReceived) {
        entries[line.id] = {
          thisQty: 0,
          actualCostPrice: String(line.expectedCostPrice),
        };
      }
    }
    setReceivingEntries(entries);
  }, [po.lines]);

  const displayableLines = useMemo(
    () => po.lines.filter((l) => !l.isFullyReceived),
    [po.lines],
  );

  const updateQty = useCallback(
    (lineId: string, qty: number) => {
      setReceivingEntries((prev) => ({
        ...prev,
        [lineId]: { ...prev[lineId]!, thisQty: qty },
      }));
    },
    [],
  );

  const updateCostPrice = useCallback(
    (lineId: string, value: string) => {
      setReceivingEntries((prev) => ({
        ...prev,
        [lineId]: { ...prev[lineId]!, actualCostPrice: value },
      }));
    },
    [],
  );

  const totalItems = useMemo(
    () =>
      Object.values(receivingEntries).reduce((sum, e) => sum + e.thisQty, 0),
    [receivingEntries],
  );

  const lineCount = useMemo(
    () =>
      Object.values(receivingEntries).filter((e) => e.thisQty > 0).length,
    [receivingEntries],
  );

  const handleSubmit = useCallback(async () => {
    // Client-side validation
    for (const line of displayableLines) {
      const entry = receivingEntries[line.id];
      if (!entry || entry.thisQty === 0) continue;

      const remaining = line.orderedQty - line.receivedQty;
      if (entry.thisQty > remaining) {
        toast.error(
          `${line.productNameSnapshot}: quantity exceeds remaining (${remaining})`,
        );
        return;
      }

      const trimmed = entry.actualCostPrice.trim();
      if (trimmed === '') continue; // will default to expected
      const parsed = Number(trimmed);
      if (isNaN(parsed) || parsed < 0) {
        toast.error(
          `${line.productNameSnapshot}: actual cost price must be a non-negative number`,
        );
        return;
      }
    }

    const receivedLines = displayableLines
      .filter((l) => {
        const entry = receivingEntries[l.id];
        return entry && entry.thisQty > 0;
      })
      .map((l) => {
        const entry = receivingEntries[l.id]!;
        const trimmed = entry.actualCostPrice.trim();
        const costPrice =
          trimmed === '' ? String(l.expectedCostPrice) : trimmed;
        return {
          lineId: l.id,
          receivedQty: entry.thisQty,
          actualCostPrice: costPrice,
        };
      });

    if (receivedLines.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/store/purchase-orders/${po.id}/receive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receivedLines }),
        },
      );
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to receive goods');
        return;
      }

      toast.success('Goods received successfully');
      onOpenChange(false);
      onSuccess({
        costPricesChanged: json.data.costPricesChanged,
        costPriceChangedCount: json.data.costPriceChangedCount,
      });
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }, [displayableLines, receivingEntries, po.id, onOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            Receive Goods
          </DialogTitle>
          <DialogDescription>
            Enter the quantities received for each line item.
          </DialogDescription>
        </DialogHeader>

        {displayableLines.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            All lines have been fully received.
          </div>
        ) : (
          <>
            <div className="rounded-md border border-mist overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Ordered</TableHead>
                    <TableHead className="text-center">Prev. Received</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead className="text-center">This Receiving</TableHead>
                    <TableHead className="text-right">Actual Cost Rs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayableLines.map((line) => {
                    const entry = receivingEntries[line.id];
                    const remaining = line.orderedQty - line.receivedQty;
                    const thisQty = entry?.thisQty ?? 0;

                    return (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p className="font-medium text-espresso">
                            {line.productNameSnapshot}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.variantDescriptionSnapshot}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          {line.orderedQty}
                        </TableCell>
                        <TableCell className="text-center">
                          {line.receivedQty}
                        </TableCell>
                        <TableCell className="text-center font-medium text-amber-600">
                          {remaining}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={thisQty <= 0}
                              onClick={() =>
                                updateQty(line.id, thisQty - 1)
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              className="w-16 text-center h-8 font-mono"
                              min={0}
                              max={remaining}
                              value={thisQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val)) {
                                  updateQty(line.id, 0);
                                } else {
                                  updateQty(
                                    line.id,
                                    Math.max(0, Math.min(remaining, val)),
                                  );
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={thisQty >= remaining}
                              onClick={() =>
                                updateQty(line.id, thisQty + 1)
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-28 text-right h-8 font-mono ml-auto"
                            value={entry?.actualCostPrice ?? ''}
                            onChange={(e) =>
                              updateCostPrice(line.id, e.target.value)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {totalItems > 0
                  ? `Receiving ${totalItems} item(s) across ${lineCount} line(s)`
                  : 'Enter quantities to receive'}
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          {displayableLines.length === 0 ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={totalItems === 0 || submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm Receipt ({totalItems} items)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
