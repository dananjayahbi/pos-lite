'use client';

import { useState } from 'react';
import { ShoppingBag, ArchiveRestore, Banknote, CreditCard, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { formatRupee } from '@/lib/format';
import { useCartStore, getCartTotal } from '@/stores/cartStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CartLineItem } from '@/components/pos/CartLineItem';
import { LineItemDiscountControl } from '@/components/pos/LineItemDiscountControl';
import { CartDiscountControl } from '@/components/pos/CartDiscountControl';
import { HoldSaleButton } from '@/components/pos/HoldSaleButton';
import { RetrieveHeldSalesSheet } from '@/components/pos/RetrieveHeldSalesSheet';
import { CashPaymentModal } from '@/components/pos/CashPaymentModal';
import { CardPaymentModal } from '@/components/pos/CardPaymentModal';
import { SplitPaymentModal } from '@/components/pos/SplitPaymentModal';
import { ReceiptPreviewDialog } from '@/components/pos/ReceiptPreviewDialog';
import type { CreateSalePayload, CompletedSale } from '@/types/pos.types';
import { usePersistCartEffect } from '@/hooks/usePersistCartEffect';
import { clearCartSnapshot } from '@/lib/idb-store';

interface CartPanelProps {
  shiftId: string;
}

export function CartPanel({ shiftId }: CartPanelProps) {
  const items = useCartStore((s) => s.items);
  const cartDiscountPercent = useCartStore((s) => s.cartDiscountPercent);
  const cartDiscountAmount = useCartStore((s) => s.cartDiscountAmount);
  const taxRate = useCartStore((s) => s.taxRate);
  const clearCart = useCartStore((s) => s.clearCart);
  const activeLineId = useCartStore((s) => s.activeLineId);
  const authorizingManagerId = useCartStore((s) => s.authorizingManagerId);

  // Persist cart to IndexedDB
  usePersistCartEffect({ items, cartDiscountPercent, cartDiscountAmount });

  const { subtotal, discountEffective, taxAmount, total } = getCartTotal(
    items,
    cartDiscountPercent,
    cartDiscountAmount,
    taxRate,
  );

  const [retrieveOpen, setRetrieveOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'split' | null>(null);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [changeAmount, setChangeAmount] = useState<Decimal | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: heldSalesData } = useQuery({
    queryKey: ['held-sales-count', shiftId],
    queryFn: async () => {
      const res = await fetch(
        `/api/store/sales?shiftId=${shiftId}&status=OPEN&limit=1`,
      );
      if (!res.ok) return { total: 0 };
      const json = await res.json();
      return { total: (json.meta?.total as number) ?? 0 };
    },
    refetchInterval: 30_000,
  });
  const heldCount = heldSalesData?.total ?? 0;

  const hasItems = items.length > 0;
  const totalDiscount = discountEffective.toNumber();

  const salePayload: CreateSalePayload = {
    shiftId,
    lines: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
    })),
    cartDiscountAmount: discountEffective.toNumber(),
    ...(authorizingManagerId ? { authorizingManagerId } : {}),
  };

  const handleSaleComplete = (sale: CompletedSale) => {
    setCompletedSale(sale);
    const change = sale.changeGiven != null ? new Decimal(sale.changeGiven) : null;
    setChangeAmount(change);
    setPaymentMode(null);
    setReceiptOpen(true);
    toast.success(`Sale completed — ${formatRupee(sale.totalAmount)}`);
  };

  const handleNewSale = () => {
    clearCart();
    clearCartSnapshot('velvetpos_cart_default').catch(() => {});
    setReceiptOpen(false);
    setCompletedSale(null);
    setChangeAmount(null);
    queryClient.invalidateQueries({ queryKey: ['held-sales-count'] });
  };

  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setCompletedSale(null);
    setChangeAmount(null);
  };

  const handleClearCart = () => {
    const snapshot = [...items];
    const snapDiscPct = cartDiscountPercent;
    const snapDiscAmt = cartDiscountAmount;
    clearCart();
    clearCartSnapshot('velvetpos_cart_default').catch(() => {});
    toast('Cart cleared', {
      action: {
        label: 'Undo',
        onClick: () => {
          useCartStore.getState().replaceCart(snapshot, snapDiscPct, snapDiscAmt);
        },
      },
      duration: 3000,
    });
  };

  return (
    <div className="flex flex-col h-full bg-pearl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] shrink-0 border-b border-mist/50">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base text-espresso">Cart</h2>
          {hasItems && (
            <span className="bg-terracotta text-pearl text-xs font-body px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {heldCount > 0 && (
            <button
              type="button"
              onClick={() => setRetrieveOpen(true)}
              className="flex items-center gap-1 font-body text-xs text-terracotta hover:text-espresso transition-colors"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Retrieve
              <span className="bg-terracotta text-pearl text-[10px] px-1.5 py-0.5 rounded-full">
                {heldCount}
              </span>
            </button>
          )}
          {hasItems && (
            <button
              type="button"
              onClick={handleClearCart}
              className="font-body text-xs text-[#9B2226] hover:text-[#9B2226]/80 transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* Line items (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-mist">
            <ShoppingBag className="h-10 w-10 mb-2" />
            <p className="font-body text-sm">Cart is empty — add a product to start</p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div key={item.variantId} className="border-b border-mist/30 last:border-b-0">
                <CartLineItem item={item} />
                {activeLineId === item.variantId && (
                  <LineItemDiscountControl item={item} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart-level discount */}
      {hasItems && <CartDiscountControl />}

      {/* Totals section */}
      {hasItems && (
        <div className="shrink-0 border-t border-espresso/10 bg-pearl shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex justify-between font-body text-sm text-espresso">
              <span>Sub-total</span>
              <span className="font-mono">{formatRupee(subtotal.toNumber())}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between font-body text-sm text-[#9B2226]">
                <span>Discount</span>
                <span className="font-mono">-{formatRupee(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-body text-sm text-espresso">
              <span>Tax {taxRate > 0 ? `(${taxRate}%)` : ''}</span>
              <span className="font-mono">{formatRupee(taxAmount.toNumber())}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1.5 border-t border-mist/30">
              <span className="font-display text-lg text-espresso font-bold">Total</span>
              <span className="font-mono text-lg text-terracotta font-bold">
                {formatRupee(total.toNumber())}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 pb-4 space-y-2">
            <HoldSaleButton shiftId={shiftId} />
            <Popover open={paymentPopoverOpen} onOpenChange={setPaymentPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={!hasItems}
                  className="w-full py-3 rounded-lg bg-espresso text-pearl font-body text-base font-bold hover:bg-espresso/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Charge / Pay
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1.5" side="top" align="center">
                <div className="space-y-0.5">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-body text-sm text-espresso hover:bg-linen transition-colors"
                    onClick={() => {
                      setPaymentPopoverOpen(false);
                      setPaymentMode('cash');
                    }}
                  >
                    <Banknote className="h-4 w-4 text-terracotta" />
                    Cash
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-body text-sm text-espresso hover:bg-linen transition-colors"
                    onClick={() => {
                      setPaymentPopoverOpen(false);
                      setPaymentMode('card');
                    }}
                  >
                    <CreditCard className="h-4 w-4 text-terracotta" />
                    Card
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-body text-sm text-espresso hover:bg-linen transition-colors"
                    onClick={() => {
                      setPaymentPopoverOpen(false);
                      setPaymentMode('split');
                    }}
                  >
                    <Layers className="h-4 w-4 text-terracotta" />
                    Split
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
      <RetrieveHeldSalesSheet
        shiftId={shiftId}
        open={retrieveOpen}
        onOpenChange={setRetrieveOpen}
      />
      <CashPaymentModal
        open={paymentMode === 'cash'}
        onClose={() => setPaymentMode(null)}
        onSaleComplete={handleSaleComplete}
        totalAmount={total}
        salePayload={salePayload}
      />
      <CardPaymentModal
        open={paymentMode === 'card'}
        onClose={() => setPaymentMode(null)}
        onSaleComplete={handleSaleComplete}
        totalAmount={total}
        salePayload={salePayload}
      />
      <SplitPaymentModal
        open={paymentMode === 'split'}
        onClose={() => setPaymentMode(null)}
        onSaleComplete={handleSaleComplete}
        totalAmount={total}
        salePayload={salePayload}
      />
      <ReceiptPreviewDialog
        open={receiptOpen}
        onClose={handleReceiptClose}
        onNewSale={handleNewSale}
        completedSale={completedSale}
        changeAmount={changeAmount}
      />
    </div>
  );
}
