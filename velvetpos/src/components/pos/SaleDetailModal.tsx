'use client';

import { formatRupee } from '@/lib/format';
import {
  Dialog,
  DialogContent,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, MessageCircle } from 'lucide-react';

interface SaleLine {
  id: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
  discountAmount: number;
  lineTotalBeforeDiscount: number;
  lineTotalAfterDiscount: number;
}

interface Sale {
  id: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'SPLIT' | null;
  status: 'OPEN' | 'COMPLETED' | 'VOIDED';
  authorizingManagerId: string | null;
  createdAt: string;
  lines: SaleLine[];
}

interface SaleDetailModalProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

export function SaleDetailModal({
  sale,
  open,
  onOpenChange,
}: SaleDetailModalProps) {
  if (!sale) return null;

  const shortId = sale.id.slice(0, 8).toUpperCase();
  const lineDiscountTotal = sale.lines.reduce(
    (sum, l) => sum + l.discountAmount,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg text-espresso">
            Sale {shortId}
          </DialogTitle>
          <p className="font-body text-xs text-mist">
            {formatDateTime(sale.createdAt)}
          </p>
        </DialogHeader>

        {/* Status banners */}
        <div className="flex items-center gap-2 mb-2">
          {sale.status === 'VOIDED' && (
            <div className="w-full rounded-lg bg-red-50 border border-red-200 p-2 text-sm font-body text-[#9B2226]">
              This sale has been voided.
            </div>
          )}
          {sale.status === 'OPEN' && (
            <Badge className="bg-[#B7791F] text-white text-[10px]">Held</Badge>
          )}
          {sale.paymentMethod && (
            <Badge variant="secondary" className="text-[10px]">
              {sale.paymentMethod}
            </Badge>
          )}
        </div>

        {/* Line items */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body text-xs">Product</TableHead>
              <TableHead className="font-body text-xs font-mono">SKU</TableHead>
              <TableHead className="font-body text-xs text-right">
                Price
              </TableHead>
              <TableHead className="font-body text-xs text-center">
                Qty
              </TableHead>
              <TableHead className="font-body text-xs text-right">
                Disc
              </TableHead>
              <TableHead className="font-body text-xs text-right">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.lines.map((line, idx) => (
              <TableRow
                key={line.id}
                className={idx % 2 === 0 ? 'bg-linen/30' : 'bg-pearl'}
              >
                <TableCell>
                  <div>
                    <p className="font-body text-xs text-espresso">
                      {line.productNameSnapshot}
                    </p>
                    <p className="font-body text-[11px] text-mist">
                      {line.variantDescriptionSnapshot}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-espresso">
                  {line.sku}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatRupee(line.unitPrice)}
                </TableCell>
                <TableCell className="text-center font-body text-xs">
                  {line.quantity}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {line.discountPercent > 0 ? `${line.discountPercent}%` : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">
                  {formatRupee(line.lineTotalAfterDiscount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totals */}
        <div className="border-t border-mist/30 pt-3 space-y-1.5">
          <div className="flex justify-between font-body text-sm text-espresso">
            <span>Sub-total</span>
            <span className="font-mono">{formatRupee(sale.subtotal)}</span>
          </div>
          {lineDiscountTotal > 0 && (
            <div className="flex justify-between font-body text-sm text-[#9B2226]">
              <span>Line Discounts</span>
              <span className="font-mono">
                -{formatRupee(lineDiscountTotal)}
              </span>
            </div>
          )}
          {sale.discountAmount > 0 && (
            <div className="flex justify-between font-body text-sm text-[#9B2226]">
              <span>Cart Discount</span>
              <span className="font-mono">
                -{formatRupee(sale.discountAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-body text-sm text-espresso">
            <span>Tax</span>
            <span className="font-mono">{formatRupee(sale.taxAmount)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-1.5 border-t border-mist/30">
            <span className="font-display text-base text-espresso font-bold">
              Total
            </span>
            <span className="font-mono text-base text-terracotta font-bold">
              {formatRupee(sale.totalAmount)}
            </span>
          </div>
        </div>

        {sale.authorizingManagerId && (
          <p className="font-body text-xs text-mist mt-1">
            Cart discount authorised by a manager.
          </p>
        )}

        {/* Footer actions (placeholders) */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-mist/30">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Available in the next update"
          >
            <Printer className="h-4 w-4 mr-1" />
            Print Receipt
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Available in the next update"
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            WhatsApp Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
