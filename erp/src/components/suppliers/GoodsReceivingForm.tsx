'use client';

import { useState, useCallback, useMemo } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
// M16-02 (BUG-49): per-line batch number / expiry date capture.
import { GrnBatchFields } from '@/components/suppliers/GrnBatchFields';

export interface POLine {
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
    form?: string | null;
    packSize?: string | null;
    costPrice: string | number;
    stockQuantity: number;
    imageUrls: string[];
    product: { name: string };
  };
}

export interface PurchaseOrderDetail {
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
  /** M16-02 (BUG-49): optional batch traceability captured on this receipt. */
  batchNumber: string;
  /** M16-02 (BUG-49): local `YYYY-MM-DD` from the date input; '' = not tracked. */
  expiryDate: string;
}

interface GoodsReceivingFormProps {
  po: PurchaseOrderDetail;
  onCancel?: () => void;
  onSuccess: (result: {
    costPricesChanged: Array<{
      variantId: string;
      oldCostPrice: string;
      newCostPrice: string;
    }>;
    costPriceChangedCount: number;
  }) => void;
  cancelLabel?: string;
}

export function GoodsReceivingForm({
  po,
  onCancel,
  onSuccess,
  cancelLabel = 'Cancel',
}: GoodsReceivingFormProps) {
  const [receivingEntries, setReceivingEntries] = useState<Record<string, ReceivingEntry>>({});
  const [submitting, setSubmitting] = useState(false);

  // Seed the per-line entry state from the PO. This runs during render (React's
  // "adjust state when props change" pattern) instead of in an effect: the
  // entries are derived from `po.lines`, and seeding them in an effect caused a
  // cascading second render on every PO load. The `po` identity guard keeps
  // in-flight edits intact when the component re-renders for its own reasons.
  const [seededPo, setSeededPo] = useState<PurchaseOrderDetail | null>(null);
  if (seededPo !== po) {
    setSeededPo(po);
    const entries: Record<string, ReceivingEntry> = {};
    for (const line of po.lines) {
      if (!line.isFullyReceived) {
        entries[line.id] = {
          thisQty: 0,
          actualCostPrice: String(line.expectedCostPrice),
          batchNumber: '',
          expiryDate: '',
        };
      }
    }
    setReceivingEntries(entries);
  }

  const displayableLines = useMemo(
    () => po.lines.filter((line) => !line.isFullyReceived),
    [po.lines],
  );

  const updateQty = useCallback((lineId: string, qty: number) => {
    setReceivingEntries((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId]!, thisQty: qty },
    }));
  }, []);

  const updateCostPrice = useCallback((lineId: string, value: string) => {
    setReceivingEntries((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId]!, actualCostPrice: value },
    }));
  }, []);

  // M16-02 (BUG-49): keep the batch traceability fields in the same line-entry
  // state as qty/cost so the POST payload is built from one source.
  const updateBatchNumber = useCallback((lineId: string, value: string) => {
    setReceivingEntries((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId]!, batchNumber: value },
    }));
  }, []);

  const updateExpiryDate = useCallback((lineId: string, value: string) => {
    setReceivingEntries((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId]!, expiryDate: value },
    }));
  }, []);

  const totalItems = useMemo(
    () => Object.values(receivingEntries).reduce((sum, entry) => sum + entry.thisQty, 0),
    [receivingEntries],
  );

  const lineCount = useMemo(
    () => Object.values(receivingEntries).filter((entry) => entry.thisQty > 0).length,
    [receivingEntries],
  );

  const handleSubmit = useCallback(async () => {
    for (const line of displayableLines) {
      const entry = receivingEntries[line.id];
      if (!entry || entry.thisQty === 0) continue;

      const remaining = line.orderedQty - line.receivedQty;
      if (entry.thisQty > remaining) {
        toast.error(`${line.productNameSnapshot}: quantity exceeds remaining (${remaining})`);
        return;
      }

      const trimmed = entry.actualCostPrice.trim();
      if (trimmed === '') continue;

      const parsed = Number(trimmed);
      if (Number.isNaN(parsed) || parsed < 0) {
        toast.error(
          `${line.productNameSnapshot}: actual cost price must be a non-negative number`,
        );
        return;
      }
    }

    const receivedLines = displayableLines
      .filter((line) => {
        const entry = receivingEntries[line.id];
        return entry && entry.thisQty > 0;
      })
      .map((line) => {
        const entry = receivingEntries[line.id]!;
        const trimmed = entry.actualCostPrice.trim();
        // M16-02 (BUG-49): send batchNumber/expiryDate only when actually
        // supplied — an omitted key keeps a non-batch line's receipt byte-for-byte
        // identical to the pre-change payload (the API treats undefined as
        // "no batch" and skips the BatchTracking write entirely).
        const batchNumber = entry.batchNumber.trim();
        const expiryDate = entry.expiryDate;
        return {
          lineId: line.id,
          receivedQty: entry.thisQty,
          actualCostPrice: Number(trimmed !== '' ? trimmed : line.expectedCostPrice),
          ...(batchNumber !== '' ? { batchNumber } : {}),
          // The API contract is `z.string().datetime()`, so the date input's
          // local YYYY-MM-DD is anchored to UTC midnight before sending.
          ...(expiryDate !== '' ? { expiryDate: new Date(`${expiryDate}T00:00:00.000Z`).toISOString() } : {}),
        };
      });

    if (receivedLines.length === 0) {
      toast.error('Enter a quantity greater than 0 for at least one line before confirming.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/store/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedLines }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to receive goods');
        return;
      }

      toast.success('Goods received successfully');
      onSuccess({
        costPricesChanged: json.data.costPricesChanged,
        costPriceChangedCount: json.data.costPriceChangedCount,
      });
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }, [displayableLines, onSuccess, po.id, receivingEntries]);

  if (displayableLines.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-mist/40 bg-linen p-6 text-center text-sm text-mist">
          All lines have already been fully received.
        </div>
        {onCancel ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-mist/40 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-center">Ordered</TableHead>
              <TableHead className="text-center">Prev. Received</TableHead>
              <TableHead className="text-center">Remaining</TableHead>
              <TableHead className="text-center">This Receiving</TableHead>
              {/* M16-02 (BUG-49): batch/expiry traceability capture point. */}
              <TableHead className="text-left">Batch / Expiry</TableHead>
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
                    <p className="font-medium text-espresso">{line.productNameSnapshot}</p>
                    <p className="text-xs text-muted-foreground">{line.variantDescriptionSnapshot}</p>
                    <p className="text-[11px] font-mono text-mist mt-1">SKU {line.variant.sku}</p>
                  </TableCell>
                  <TableCell className="text-center">{line.orderedQty}</TableCell>
                  <TableCell className="text-center">{line.receivedQty}</TableCell>
                  <TableCell className="text-center font-medium text-amber-600">{remaining}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={thisQty <= 0 || submitting}
                        onClick={() => updateQty(line.id, thisQty - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        className="w-16 text-center h-8 font-mono"
                        min={0}
                        max={remaining}
                        value={thisQty}
                        disabled={submitting}
                        onChange={(e) => {
                          const value = Number.parseInt(e.target.value, 10);
                          if (Number.isNaN(value)) {
                            updateQty(line.id, 0);
                            return;
                          }

                          updateQty(line.id, Math.max(0, Math.min(remaining, value)));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={thisQty >= remaining || submitting}
                        onClick={() => updateQty(line.id, thisQty + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  {/* M16-02 (BUG-49): modular per-line batch/expiry subcomponent. */}
                  <TableCell className="align-top pt-3">
                    <GrnBatchFields
                      lineId={line.id}
                      batchNumber={entry?.batchNumber ?? ''}
                      expiryDate={entry?.expiryDate ?? ''}
                      disabled={submitting}
                      onBatchNumberChange={(value) => updateBatchNumber(line.id, value)}
                      onExpiryDateChange={(value) => updateExpiryDate(line.id, value)}
                    />
                  </TableCell>
                  <TableCell className="text-right align-top pt-3">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="w-28 text-right h-8 font-mono ml-auto"
                      value={entry?.actualCostPrice ?? ''}
                      disabled={submitting}
                      onChange={(e) => updateCostPrice(line.id, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-mist/40 bg-linen/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-espresso">
            {totalItems > 0
              ? `Receiving ${totalItems} item(s) across ${lineCount} line(s)`
              : 'Enter quantities to receive'}
          </p>
          <p className="text-xs text-mist mt-1">
            Adjust actual cost prices only when the supplier invoice differs from the expected amount.
            Batch number and expiry date are optional — fill them in to keep the received goods
            traceable in Inventory → Batches.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button variant="outline" onClick={onCancel} disabled={submitting}>
              {cancelLabel}
            </Button>
          ) : null}
          <Button onClick={handleSubmit} disabled={totalItems === 0 || submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Receipt ({totalItems} items)
          </Button>
        </div>
      </div>
    </div>
  );
}
