'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/stores/cartStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReturnItemSelectionStep } from '@/components/pos/ReturnItemSelectionStep';
import { ReturnRefundOptionsStep } from '@/components/pos/ReturnRefundOptionsStep';
import { ManagerPINStep } from '@/components/pos/ManagerPINStep';
import { ReturnReceiptDialog } from '@/components/pos/ReturnReceiptDialog';
import type { ReturnRefundMethod } from '@/generated/prisma/client';
import Decimal from 'decimal.js';
import { formatRupee } from '@/lib/format';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

interface SelectedLine {
  saleLineId: string;
  variantId: string;
  quantity: number;
}

interface ReturnWizardSheetProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnComplete: () => void;
}

export function ReturnWizardSheet({ saleId, open, onOpenChange, onReturnComplete }: ReturnWizardSheetProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>('CASH');
  const [cardReversalReference, setCardReversalReference] = useState('');
  const [restockItems, setRestockItems] = useState(true);
  const [reason, setReason] = useState('');
  const [authorizingManagerId, setAuthorizingManagerId] = useState<string | null>(null);
  const [authorizationTimestamp, setAuthorizationTimestamp] = useState<number | null>(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptState, setReceiptState] = useState<{
    returnId: string;
    refundAmount: number | string;
    refundMethod: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();

  const { data: saleData, isLoading, error, refetch } = useQuery({
    queryKey: ['sale-return', saleId],
    queryFn: async () => {
      const res = await fetch(`/api/store/sales/${saleId}`);
      if (!res.ok) throw new Error('Failed to fetch sale');
      const json = await res.json() as { success: boolean; data: Record<string, unknown> };
      return json.data;
    },
    enabled: open && saleId !== null,
  });

  const resetWizard = useCallback(() => {
    setStep(1);
    setSelectedLines([]);
    setRefundMethod('CASH');
    setCardReversalReference('');
    setRestockItems(true);
    setReason('');
    setAuthorizingManagerId(null);
    setAuthorizationTimestamp(null);
    setShowAbandonConfirm(false);
    setReceiptState(null);
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (step >= 2) {
        setShowAbandonConfirm(true);
        return;
      }
      resetWizard();
      onOpenChange(false);
    } else {
      onOpenChange(true);
    }
  };

  const handleAbandon = () => {
    resetWizard();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!saleId || !authorizingManagerId) return;

    if (authorizationTimestamp !== null && Date.now() - authorizationTimestamp > 5 * 60 * 1000) {
      setAuthorizingManagerId(null);
      setAuthorizationTimestamp(null);
      toast.error('Authorization expired. Re-enter PIN.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalSaleId: saleId,
          lines: selectedLines.map((l) => ({
            saleLineId: l.saleLineId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          refundMethod,
          restockItems,
          reason,
          authorizedById: authorizingManagerId,
          ...(refundMethod === 'CARD_REVERSAL' && cardReversalReference
            ? { cardReversalReference }
            : {}),
        }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(json?.error?.message ?? 'Failed to process return');
        return;
      }

      const json = (await res.json()) as { success: boolean; data: { id: string; refundAmount: number | string } };
      const returnRecord = json.data;

      void queryClient.invalidateQueries({ queryKey: ['sale-history'] });

      if (refundMethod === 'EXCHANGE') {
        const store = useCartStore.getState();
        store.clearCart();
        store.setExchangeCredit(
          returnRecord.id,
          Number(returnRecord.refundAmount),
          returnRecord.id.slice(0, 8).toUpperCase(),
        );
        toast.success('Return processed. Exchange credit applied to cart.');
      } else {
        toast.success('Return processed successfully.');
        setReceiptState({
          returnId: returnRecord.id,
          refundAmount: returnRecord.refundAmount,
          refundMethod,
        });
        return;
      }

      resetWizard();
      onOpenChange(false);
      onReturnComplete();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute refund total from selected lines
  const computeRefundTotal = (): Decimal => {
    if (!saleData) return new Decimal(0);
    const sale = saleData as { lines: Array<{ id: string; quantity: number; lineTotalAfterDiscount: number }> };
    let total = new Decimal(0);
    for (const sel of selectedLines) {
      const saleLine = sale.lines.find((l) => l.id === sel.saleLineId);
      if (saleLine && sel.quantity > 0) {
        const lineRefund = new Decimal(sel.quantity)
          .div(new Decimal(saleLine.quantity))
          .mul(new Decimal(saleLine.lineTotalAfterDiscount.toString()))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        total = total.plus(lineRefund);
      }
    }
    return total;
  };

  const refundTotal = computeRefundTotal();
  const hasSelectedItems = selectedLines.some((l) => l.quantity > 0);

  const canProceedStep3 =
    authorizingManagerId !== null &&
    authorizationTimestamp !== null &&
    Date.now() - authorizationTimestamp < 5 * 60 * 1000;

  const stepLabels = ['Select Items', 'Refund Options', 'Authorization'];

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0"
        onInteractOutside={(e) => {
          if (step >= 2) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (step >= 2) {
            e.preventDefault();
            setShowAbandonConfirm(true);
          }
        }}
      >
        <SheetHeader className="px-6 py-4 border-b border-mist/30 bg-linen">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-lg text-espresso">
              Return Items
            </SheetTitle>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {stepLabels.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2 | 3;
              const isActive = step === stepNum;
              const isCompleted = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className={`h-px w-6 ${isCompleted ? 'bg-terracotta' : 'bg-mist/50'}`} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-body font-medium ${
                        isActive
                          ? 'bg-terracotta text-white'
                          : isCompleted
                            ? 'bg-terracotta/20 text-terracotta'
                            : 'bg-mist/30 text-mist'
                      }`}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={`text-xs font-body ${
                        isActive ? 'text-espresso font-medium' : 'text-mist'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetHeader>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Abandon confirmation overlay */}
          {showAbandonConfirm && (
            <div className="absolute inset-0 z-50 bg-white/90 flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <p className="font-body text-sm text-espresso">
                  You have an in-progress return. Are you sure you want to cancel?
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAbandonConfirm(false)}
                  >
                    Continue Return
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#9B2226] text-white hover:bg-[#9B2226]/90"
                    onClick={handleAbandon}
                  >
                    Abandon Return
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded bg-linen" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-3">
              <p className="font-body text-sm text-[#9B2226]">Failed to load sale details</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : saleData ? (
            <>
              {step === 1 && (
                <ReturnItemSelectionStep
                  sale={saleData as never}
                  value={selectedLines}
                  restockItems={restockItems}
                  onChange={(lines, restock) => {
                    setSelectedLines(lines);
                    setRestockItems(restock);
                  }}
                />
              )}
              {step === 2 && (
                <ReturnRefundOptionsStep
                  refundTotal={refundTotal}
                  refundMethod={refundMethod}
                  cardReversalReference={cardReversalReference}
                  reason={reason}
                  onChange={(patch) => {
                    if (patch.refundMethod !== undefined) setRefundMethod(patch.refundMethod);
                    if (patch.cardReversalReference !== undefined) setCardReversalReference(patch.cardReversalReference);
                    if (patch.reason !== undefined) setReason(patch.reason);
                  }}
                />
              )}
              {step === 3 && (
                <>
                  {canProceedStep3 ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="font-body text-sm text-espresso font-medium">Manager Authorized</p>
                      <p className="font-body text-xs text-mist">
                        Authorized at {new Date(authorizationTimestamp!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <ManagerPINStep onAuthorized={(managerId) => {
                      setAuthorizingManagerId(managerId);
                      setAuthorizationTimestamp(Date.now());
                    }} />
                  )}
                </>
              )}
            </>
          ) : null}
        </div>

        {/* Navigation footer */}
        <div className="px-6 py-3 border-t border-mist/30 bg-linen flex items-center justify-between">
          {step === 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetWizard();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            >
              ← Back
            </Button>
          )}
          {step === 1 && (
            <Button
              size="sm"
              disabled={!hasSelectedItems}
              onClick={() => setStep(2)}
              className="bg-terracotta text-white hover:bg-terracotta/90"
            >
              Next: Refund Options →
            </Button>
          )}
          {step === 2 && (
            <Button
              size="sm"
              onClick={() => setStep(3)}
              className="bg-terracotta text-white hover:bg-terracotta/90"
            >
              Next: Authorize →
            </Button>
          )}
          {step === 3 && (
            <Button
              size="sm"
              disabled={!canProceedStep3 || isSubmitting}
              onClick={handleSubmit}
              className="bg-terracotta text-white hover:bg-terracotta/90"
            >
              {isSubmitting ? 'Processing…' : 'Process Return'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>

    {receiptState !== null && (
      <ReturnReceiptDialog
        returnId={receiptState.returnId}
        refundAmount={receiptState.refundAmount}
        refundMethod={receiptState.refundMethod}
        open={receiptState !== null}
        onOpenChange={() => {
          resetWizard();
          onOpenChange(false);
          onReturnComplete();
        }}
        onDone={() => {
          resetWizard();
          onOpenChange(false);
          onReturnComplete();
        }}
      />
    )}
    </>
  );
}
