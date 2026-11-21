'use client';

import { formatRupee } from '@/lib/format';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SaleDetailModal } from '@/components/pos/SaleDetailModal';
import { returnStaffLabel } from '@/components/returns/returnAuthorizer';
import { Printer, Check, Minus, Undo2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
    paymentMethod: 'CASH' | 'CARD' | 'LANKAQR' | 'SPLIT' | 'STORE_CREDIT' | 'EXCHANGE_CREDIT' | 'NONE' | null;
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
  initiatedBy: { id: string; email: string } | null;
  authorizedBy: { id: string; email: string } | null;
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const role = session?.user?.role;
  const canReverse =
    (role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN') &&
    returnData?.status === 'COMPLETED';

  if (!returnData) return null;

  async function handleCancelReturn() {
    if (!returnData) return;
    if (cancelReason.trim().length < 5) {
      toast.error('Enter a reason of at least 5 characters');
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/store/returns/${returnData.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to reverse return');
      toast.success('Return reversed; stock, credit and the refund ledger were restored');
      setCancelOpen(false);
      setCancelReason('');
      void queryClient.invalidateQueries({ queryKey: ['returns'] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reverse return');
    } finally {
      setCancelling(false);
    }
  }

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
            <p className="font-body text-xs text-mist-ink">
              {formatDateTime(returnData.createdAt)}
            </p>
          </DialogHeader>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-body">
            <div>
              <span className="text-mist-ink text-xs">Original Sale</span>
              <p className="text-espresso font-mono text-xs">
                {returnData.originalSale.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div>
              <span className="text-mist-ink text-xs">Cashier</span>
              <p className="text-espresso">{returnStaffLabel(returnData.initiatedBy)}</p>
            </div>
            <div>
              <span className="text-mist-ink text-xs">Manager</span>
              <p className="text-espresso">{returnStaffLabel(returnData.authorizedBy)}</p>
            </div>
            <div>
              <span className="text-mist-ink text-xs">Refund Method</span>
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
              <span className="text-mist-ink text-xs">Refund Amount</span>
              <p className="text-espresso font-mono font-medium">
                {formatRupee(returnData.refundAmount)}
              </p>
            </div>
            <div>
              <span className="text-mist-ink text-xs">Restock Status</span>
              <p className="text-espresso">
                {allRestocked ? 'All Restocked' : someRestocked ? 'Partial' : 'Not Restocked'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-mist-ink text-xs">Return Reason</span>
              <p className="text-espresso">{returnData.reason || '-'}</p>
            </div>
          </div>

          {/* Lines table */}
          <div className="border border-mist/30 rounded-lg overflow-hidden mt-2">
            <Table>
              <TableHeader>
                <TableRow className="bg-linen">
                  <TableHead className="font-body text-xs text-mist-ink">Product</TableHead>
                  <TableHead className="font-body text-xs text-mist-ink">Variant</TableHead>
                  <TableHead className="font-body text-xs text-mist-ink text-center">Qty</TableHead>
                  <TableHead className="font-body text-xs text-mist-ink text-right">Refund</TableHead>
                  <TableHead className="font-body text-xs text-mist-ink text-center">Restocked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnData.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-body text-xs text-espresso">
                      {line.productNameSnapshot}
                    </TableCell>
                    <TableCell className="font-body text-xs text-mist-ink">
                      {line.variantDescriptionSnapshot || '-'}
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
                        <Minus className="h-4 w-4 text-mist-ink mx-auto" />
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
              onClick={() =>
                window.open(
                  `/api/store/returns/${returnData.id}/receipt`,
                  '_blank',
                  'noopener',
                )
              }
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print Return Receipt
            </Button>
            {canReverse ? (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                <Undo2 className="h-4 w-4 mr-1.5" />
                Reverse return
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse this return?</DialogTitle>
            <DialogDescription>
              This removes the restocked units, recovers the refund from the customer&apos;s store
              credit or the payment account it was paid from, and marks the return cancelled. It
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Reason for reversing the return (required)"
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep return
            </Button>
            <Button variant="destructive" onClick={handleCancelReturn} disabled={cancelling}>
              {cancelling ? 'Reversing…' : 'Reverse return'}
            </Button>
          </DialogFooter>
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
