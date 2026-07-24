'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupee } from '@/lib/format';
import Decimal from 'decimal.js';

interface SaleLineWithReturned {
  id: string;
  variantId: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotalAfterDiscount: number;
  returnedQuantity: number;
}

interface SelectedLine {
  saleLineId: string;
  variantId: string;
  quantity: number;
}

interface ReturnItemSelectionStepProps {
  sale: { lines: SaleLineWithReturned[] };
  value: SelectedLine[];
  restockItems: boolean;
  onChange: (lines: SelectedLine[], restockItems: boolean) => void;
}

export function ReturnItemSelectionStep({
  sale,
  value,
  restockItems,
  onChange,
}: ReturnItemSelectionStepProps) {
  const getReturnQty = (lineId: string): number => {
    return value.find((v) => v.saleLineId === lineId)?.quantity ?? 0;
  };

  const updateQty = (line: SaleLineWithReturned, delta: number) => {
    const returnable = line.quantity - line.returnedQuantity;
    const current = getReturnQty(line.id);
    const next = Math.max(0, Math.min(returnable, current + delta));

    const updated = value.filter((v) => v.saleLineId !== line.id);
    if (next > 0) {
      updated.push({ saleLineId: line.id, variantId: line.variantId, quantity: next });
    }
    onChange(updated, restockItems);
  };

  // Compute refund preview
  const previewLines = sale.lines
    .map((line) => {
      const qty = getReturnQty(line.id);
      if (qty <= 0) return null;
      const refund = new Decimal(qty)
        .div(new Decimal(line.quantity))
        .mul(new Decimal(line.lineTotalAfterDiscount.toString()))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      return { name: line.productNameSnapshot, qty, refund };
    })
    .filter(Boolean) as { name: string; qty: number; refund: Decimal }[];

  const grandTotal = previewLines.reduce(
    (sum, l) => sum.plus(l.refund),
    new Decimal(0),
  );

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-body text-xs">Product</TableHead>
            <TableHead className="font-body text-xs text-right">Unit Price</TableHead>
            <TableHead className="font-body text-xs text-center">Orig.</TableHead>
            <TableHead className="font-body text-xs text-center">Returned</TableHead>
            <TableHead className="font-body text-xs text-center">Returnable</TableHead>
            <TableHead className="font-body text-xs text-center">Return Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sale.lines.map((line) => {
            const returnable = line.quantity - line.returnedQuantity;
            const currentQty = getReturnQty(line.id);
            const isDisabled = returnable <= 0;

            return (
              <TableRow
                key={line.id}
                className={isDisabled ? 'opacity-40' : 'hover:bg-linen/50'}
              >
                <TableCell>
                  <div>
                    <p className="font-body text-sm text-espresso">
                      {line.productNameSnapshot}
                    </p>
                    <p className="font-body text-xs text-mist">
                      {line.variantDescriptionSnapshot}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-espresso">
                  {formatRupee(line.unitPrice)}
                </TableCell>
                <TableCell className="text-center font-body text-xs text-espresso">
                  {line.quantity}
                </TableCell>
                <TableCell className="text-center font-body text-xs text-mist">
                  {line.returnedQuantity > 0 ? line.returnedQuantity : '—'}
                </TableCell>
                <TableCell className="text-center font-body text-xs">
                  {returnable > 0 ? (
                    <span className="text-espresso">{returnable}</span>
                  ) : (
                    <span className="text-mist">None remaining</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={isDisabled || currentQty <= 0}
                      onClick={() => updateQty(line, -1)}
                      aria-label={`Decrease return quantity for ${line.productNameSnapshot}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-mono text-sm text-espresso">
                      {currentQty}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={isDisabled || currentQty >= returnable}
                      onClick={() => updateQty(line, 1)}
                      aria-label={`Increase return quantity for ${line.productNameSnapshot}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Refund preview */}
      {previewLines.length > 0 && (
        <div className="rounded-lg border border-mist/30 bg-linen/50 p-4 space-y-2">
          {previewLines.map((pl) => (
            <div
              key={pl.name}
              className="flex items-center justify-between font-body text-sm text-espresso"
            >
              <span>
                {pl.name} ×{pl.qty}
              </span>
              <span className="font-mono text-xs">
                {formatRupee(pl.refund.toNumber())}
              </span>
            </div>
          ))}
          <div className="border-t border-mist/30 pt-2 flex items-center justify-between">
            <span className="font-body text-xs text-mist uppercase tracking-wide">
              Estimated Refund Total
            </span>
            <span className="font-mono text-lg font-bold text-espresso">
              {formatRupee(grandTotal.toNumber())}
            </span>
          </div>
          <p className="font-body text-[11px] text-mist">
            Final refund amount may differ if line discounts were applied.
          </p>
        </div>
      )}

      {/* Restock toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            id="restock-toggle"
            checked={restockItems}
            onCheckedChange={(checked) => onChange(value, checked)}
          />
          <Label htmlFor="restock-toggle" className="font-body text-sm text-espresso cursor-pointer">
            Restock returned items to inventory
          </Label>
        </div>
        {!restockItems && (
          <p className="font-body text-xs text-terracotta ml-11">
            Returned items will not be added back to stock. Use this for damaged or unsellable items.
          </p>
        )}
      </div>
    </div>
  );
}
