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
import { SaleDetailModal } from '@/components/pos/SaleDetailModal';
import { Printer, Check, Minus } from 'lucide-react';
import { useState } from 'react';

interface ReturnLineData {
  id: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  quantity: number;
  unitPrice: number | string;
  lineRefundAmount: number | string;
  isRestocked: boolean;
}

interface ReturnData {
  id: string;
  refundAmount: number | string;
  refundMethod: 'CASH' | 'CARD_REVERSAL' | 'STORE_CREDIT' | 'EXCHANGE';
  restockItems: boolean;
  reason: string;
  createdAt: string;
  status: string;
  lines: ReturnLineData[];
  originalSale: {
    id: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: 'CASH' | 'CARD' | 'SPLIT' | null;
    status: 'OPEN' | 'COMPLETED' | 'VOIDED';
    authorizingManagerId: string | null;
    createdAt: string;
    lines: Array<{
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
    }>;
  };
  initiatedBy: { id: string; name: string };
  authorizedBy: { id: string; name: string };
}

interface ReturnDetailModalProps {
  returnData: ReturnData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const refundMethodLabel: Record<string, string> = {
  CASH: 'Cash',
  CARD_REVERSAL: 'Card Reversal',
  STORE_CREDIT: 'Store Credit',
  EXCHANGE: 'Exchange',
};

const refundMethodBadge: Record<string, string> = {
  CASH: 'bg-green-100 text-green-800 border-green-200',
  CARD_REVERSAL: 'bg-blue-100 text-blue-800 border-blue-200',
  STORE_CREDIT: 'bg-mist/30 text-espresso border-mist',
  EXCHANGE: 'bg-terracotta text-white border-terracotta',
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

export function ReturnDetailModal({
  returnData,
  open,
  onOpenChange,
}: ReturnDetailModalProps) {
  const [saleModalOpen, setSaleModalOpen] = useState(false);

  if (!returnData) return null;

  const shortRef = returnData.id.slice(0, 8).toUpperCase();
  const allRestocked = returnData.lines.every((l) => l.isRestocked);
  const someRestocked = returnData.lines.some((l) => l.isRestocked);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-espresso">
              Return {shortRef}
            </DialogTitle>
            <p className="font-body text-xs text-mist">
              {formatDateTime(returnData.createdAt)}
            </p>
          </DialogHeader>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-body">
            <div>
              <span className="text-mist text-xs">Original Sale</span>
              <p className="text-espresso font-mono text-xs">
                {returnData.originalSale.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div>
              <span className="text-mist text-xs">Cashier</span>
              <p className="text-espresso">{returnData.initiatedBy.name}</p>
            </div>
            <div>
              <span className="text-mist text-xs">Manager</span>
              <p className="text-espresso">{returnData.authorizedBy.name}</p>
            </div>
            <div>
              <span className="text-mist text-xs">Refund Method</span>
              <div className="mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${refundMethodBadge[returnData.refundMethod] ?? ''}`}
                >
                  {refundMethodLabel[returnData.refundMethod] ?? returnData.refundMethod}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-mist text-xs">Refund Amount</span>
              <p className="text-espresso font-mono font-medium">
                {formatRupee(returnData.refundAmount)}
              </p>
            </div>
            <div>
              <span className="text-mist text-xs">Restock Status</span>
              <p className="text-espresso">
                {allRestocked ? 'All Restocked' : someRestocked ? 'Partial' : 'Not Restocked'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-mist text-xs">Return Reason</span>
              <p className="text-espresso">{returnData.reason || '—'}</p>
            </div>
          </div>

          {/* Lines table */}
          <div className="border border-mist/30 rounded-lg overflow-hidden mt-2">
            <Table>
              <TableHeader>
                <TableRow className="bg-linen">
                  <TableHead className="font-body text-xs text-mist">Product</TableHead>
                  <TableHead className="font-body text-xs text-mist">Variant</TableHead>
                  <TableHead className="font-body text-xs text-mist text-center">Qty</TableHead>
                  <TableHead className="font-body text-xs text-mist text-right">Refund</TableHead>
                  <TableHead className="font-body text-xs text-mist text-center">Restocked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnData.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-body text-xs text-espresso">
                      {line.productNameSnapshot}
                    </TableCell>
                    <TableCell className="font-body text-xs text-mist">
                      {line.variantDescriptionSnapshot || '—'}
                    </TableCell>
                    <TableCell className="font-body text-xs text-espresso text-center">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-espresso text-right">
                      {formatRupee(line.lineRefundAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.isRestocked ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <Minus className="h-4 w-4 text-mist mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaleModalOpen(true)}
            >
              Original Sale
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print Return Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SaleDetailModal
        sale={returnData.originalSale}
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
      />
    </>
  );
}
