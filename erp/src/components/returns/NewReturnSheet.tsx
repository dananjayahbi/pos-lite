'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { canAuthorizeReturn } from '@/components/returns/returnAuthorizer';
import {
  REFUND_METHODS,
  defaultRefundMethodForSale,
  refundMethodTenderMismatchReason,
  type SaleTenderSnapshot,
} from '@/lib/services/returnTender.core';
import type { PaymentLegMethod, PaymentMethod, ReturnRefundMethod } from '@/generated/prisma/client';
import { formatRupee } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleLine {
  id: string;
  variantId: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  returnedQuantity: number;
}

interface SaleDetail {
  id: string;
  totalAmount: string;
  customer?: { id: string } | null;
  /** Tender header + legs, used to constrain the refund method (ARGUS #96). */
  paymentMethod?: PaymentMethod | null;
  payments?: Array<{ method: PaymentLegMethod; amount?: string | number }>;
  lines: SaleLine[];
}

interface ReturnLine {
  saleLineId: string;
  variantId: string;
  maxQty: number;
  quantity: number;
  enabled: boolean;
  productName: string;
  variantDesc: string;
  sku: string;
}

type RefundMethod = 'CASH' | 'CARD_REVERSAL' | 'STORE_CREDIT';

interface NewReturnSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewReturnSheet({ open, onOpenChange, onSuccess }: NewReturnSheetProps) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';

  const [saleIdInput, setSaleIdInput] = useState('');
  const [queriedSaleId, setQueriedSaleId] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [restockItems, setRestockItems] = useState(true);
  const [reason, setReason] = useState('');
  const [cardReversalRef, setCardReversalRef] = useState('');

  const {
    data: sale,
    isFetching: saleFetching,
    error: saleError,
  } = useQuery({
    queryKey: ['saleForReturn', queriedSaleId],
    queryFn: async () => {
      const res = await fetch(
        `/api/store/returns/sale-lookup?reference=${encodeURIComponent(queriedSaleId)}`,
      );
      const json = (await res.json()) as { success: boolean; data?: SaleDetail; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Sale not found');
      return json.data!;
    },
    enabled: queriedSaleId.length > 0,
    retry: false,
  });

  function lookupSale() {
    const trimmed = saleIdInput.trim();
    if (trimmed) setQueriedSaleId(trimmed);
  }

  // Initialise return lines when sale data loads
  useEffect(() => {
    if (!sale) return;
    setReturnLines(
      sale.lines
        .filter((l) => l.quantity - l.returnedQuantity > 0)
        .map((l) => ({
          saleLineId: l.id,
          variantId: l.variantId,
          maxQty: l.quantity - l.returnedQuantity,
          quantity: 1,
          enabled: false,
          productName: l.productNameSnapshot,
          variantDesc: l.variantDescriptionSnapshot,
          sku: l.sku,
        })),
    );
  }, [sale]);

  const selectedLines = returnLines.filter((l) => l.enabled && l.quantity > 0);
  const storeCreditAvailable = Boolean(sale?.customer?.id);

  // ARGUS #96: only refund through a tender the sale collected.
  const tenderMismatchReasons = useMemo(() => {
    const reasons: Partial<Record<ReturnRefundMethod, string>> = {};
    if (!sale) return reasons;
    for (const method of REFUND_METHODS) {
      const reason = refundMethodTenderMismatchReason(
        method,
        sale as SaleTenderSnapshot,
      );
      if (reason) reasons[method] = reason;
    }
    return reasons;
  }, [sale]);

  // Derived, never synced via an effect: a method ruled out by the original
  // tender or the customer link falls back without cascading renders.
  const fallbackRefundMethod = defaultRefundMethodForSale(sale as SaleTenderSnapshot, {
    storeCreditAvailable,
  });
  const effectiveRefundMethod: RefundMethod =
    (refundMethod !== 'STORE_CREDIT' || storeCreditAvailable) &&
    !tenderMismatchReasons[refundMethod]
      ? refundMethod
      // This sheet has no EXCHANGE action (it needs a replacement cart); fall
      // back to store credit, which the customer rule then validates.
      : fallbackRefundMethod === 'EXCHANGE'
        ? 'STORE_CREDIT'
        : fallbackRefundMethod;

  const { mutate: submitReturn, isPending } = useMutation({
    mutationFn: async () => {
      if (selectedLines.length === 0) throw new Error('Select at least one item to return');
      if (effectiveRefundMethod === 'STORE_CREDIT' && !storeCreditAvailable) {
        throw new Error('Store credit requires a sale linked to a customer');
      }
      if (tenderMismatchReasons[effectiveRefundMethod]) {
        throw new Error(tenderMismatchReasons[effectiveRefundMethod]);
      }

      if (!currentUserId) throw new Error('Session expired, please refresh');
      const body: Record<string, unknown> = {
        // ARGUS #98: the lookup accepts a printed reference, but the API stores
        // the resolved full id.
        originalSaleId: sale?.id ?? queriedSaleId,
        lines: selectedLines.map((l) => ({
          saleLineId: l.saleLineId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        refundMethod: effectiveRefundMethod,
        restockItems,
        reason: reason.trim(),
        // ARGUS #95: a manager/owner authorizes their own return. A non-manager
        // with an explicit `sale:refund` override sends nothing — recording
        // them as the authorizer would fail the manager check in the route.
        ...(canAuthorizeReturn(session?.user?.role) ? { authorizedById: currentUserId } : {}),
      };
      if (effectiveRefundMethod === 'CARD_REVERSAL' && cardReversalRef.trim()) {
        body.cardReversalReference = cardReversalRef.trim();
      }

      const res = await fetch('/api/store/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to process return');
      return json;
    },
    onSuccess: () => {
      toast.success('Return processed successfully');
      void qc.invalidateQueries({ queryKey: ['returns'] });
      onSuccess?.();
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to process return');
    },
  });

  function resetForm() {
    setSaleIdInput('');
    setQueriedSaleId('');
    setReturnLines([]);
    setRefundMethod('CASH');
    setRestockItems(true);
    setReason('');
    setCardReversalRef('');
  }

  const canSubmit =
    selectedLines.length > 0 &&
    !isPending &&
    (effectiveRefundMethod !== 'STORE_CREDIT' || storeCreditAvailable) &&
    !tenderMismatchReasons[effectiveRefundMethod] &&
    (effectiveRefundMethod !== 'CARD_REVERSAL' || cardReversalRef.trim().length > 0);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!isPending) {
          if (!v) resetForm();
          onOpenChange(v);
        }
      }}
    >
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle className="font-display text-espresso">Process Return</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {/* Sale lookup */}
          <div>
            <Label htmlFor="sale-id-input" className="mb-1.5 block text-xs font-semibold text-espresso">
              Original Sale Reference
            </Label>
            <div className="flex gap-2">
              <Input
                id="sale-id-input"
                value={saleIdInput}
                onChange={(e) => setSaleIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupSale()}
                placeholder="Paste sale reference or ID…"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={lookupSale}
                disabled={!saleIdInput.trim() || saleFetching}
              >
                {saleFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Error */}
          {saleError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {saleError instanceof Error ? saleError.message : 'Sale not found'}
            </div>
          )}

          {/* Sale lines */}
          {sale && returnLines.length === 0 && (
            <p className="rounded-lg border border-mist bg-linen px-3 py-2 text-sm text-sand-ink">
              All items on this sale have already been returned.
            </p>
          )}

          {returnLines.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-espresso">
                Select items to return
                {sale && (
                  <span className="ml-1.5 font-normal text-sand-ink">
                    - Sale {sale.id.slice(0, 8).toUpperCase()} · {formatRupee(parseFloat(sale.totalAmount))}
                  </span>
                )}
              </p>
              <div className="divide-y divide-mist/40 rounded-lg border border-mist">
                {returnLines.map((line, idx) => (
                  <div key={line.saleLineId} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      id={`return-line-${idx}`}
                      checked={line.enabled}
                      onChange={(e) =>
                        setReturnLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, enabled: e.target.checked } : l)),
                        )
                      }
                      className="h-4 w-4 accent-terracotta"
                    />
                    <label htmlFor={`return-line-${idx}`} className="min-w-0 flex-1 cursor-pointer">
                      <p className="truncate text-sm font-medium text-espresso">{line.productName}</p>
                      <p className="text-xs text-sand-ink">
                        {line.variantDesc} · {line.sku}
                      </p>
                    </label>
                    <div className="flex shrink-0 items-center gap-1">
                      <Input
                        type="number"
                        min="1"
                        max={line.maxQty}
                        value={line.quantity}
                        disabled={!line.enabled}
                        onChange={(e) =>
                          setReturnLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), l.maxQty) }
                                : l,
                            ),
                          )
                        }
                        className="h-8 w-16 text-center"
                      />
                      <span className="text-xs text-sand-ink">/ {line.maxQty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {returnLines.length > 0 && (
            <>
              {/* Refund method */}
              <div>
                <Label className="mb-2 block text-xs font-semibold text-espresso">Refund Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'CARD_REVERSAL', 'STORE_CREDIT'] as const).map((m) => {
                    const unavailableReason =
                      m === 'STORE_CREDIT' && !storeCreditAvailable
                        ? 'Not available: the original sale is not linked to a customer'
                        : tenderMismatchReasons[m];
                    const unavailable = unavailableReason !== undefined;
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={unavailable}
                        title={unavailableReason}
                        onClick={() => setRefundMethod(m)}
                        className={`rounded-md border py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          effectiveRefundMethod === m
                            ? 'border-terracotta bg-terracotta/10 text-terracotta'
                            : 'border-mist text-sand-ink hover:border-terracotta/50 hover:text-espresso'
                        }`}
                      >
                        {m === 'CARD_REVERSAL' ? 'Card Reversal' : m === 'STORE_CREDIT' ? 'Store Credit' : 'Cash'}
                      </button>
                    );
                  })}
                </div>
                {!storeCreditAvailable && (
                  <p className="mt-1.5 text-[11px] text-mist-ink">
                    Store credit needs a sale linked to a customer.
                  </p>
                )}
                {tenderMismatchReasons[effectiveRefundMethod] && (
                  <p className="mt-1.5 text-[11px] text-[#9B2226]">
                    {tenderMismatchReasons[effectiveRefundMethod]}
                  </p>
                )}
              </div>

              {/* Card reversal reference */}
              {effectiveRefundMethod === 'CARD_REVERSAL' && (
                <div>
                  <Label htmlFor="card-reversal-ref" className="mb-1.5 block text-xs font-semibold text-espresso">
                    Reversal Reference <span className="text-terracotta">*</span>
                  </Label>
                  <Input
                    id="card-reversal-ref"
                    value={cardReversalRef}
                    onChange={(e) => setCardReversalRef(e.target.value)}
                    placeholder="Bank reference number"
                    maxLength={50}
                  />
                </div>
              )}

              {/* Restock toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="restock-items"
                  checked={restockItems}
                  onChange={(e) => setRestockItems(e.target.checked)}
                  className="h-4 w-4 accent-terracotta"
                />
                <label htmlFor="restock-items" className="cursor-pointer text-sm text-espresso">
                  Return items to stock
                </label>
              </div>

              {/* Reason */}
              <div>
                <Label htmlFor="return-reason" className="mb-1.5 block text-xs font-semibold text-espresso">
                  Reason <span className="font-normal text-sand-ink">(optional)</span>
                </Label>
                <Input
                  id="return-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer changed mind, defective item…"
                  maxLength={200}
                />
              </div>
            </>
          )}
        </div>

        <SheetFooter className="shrink-0 gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => submitReturn()}
            disabled={!canSubmit}
            className="bg-espresso text-pearl hover:bg-espresso/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Process Return
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
