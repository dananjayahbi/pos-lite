'use client';

import { useState } from 'react';
import { ShoppingBag, ArchiveRestore, Banknote, CreditCard, Layers, X, Tag } from 'lucide-react';
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
import { CustomerSearchDropdown } from '@/components/customers/CustomerSearchDropdown';
import { Switch } from '@/components/ui/switch';
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
  const linkedCustomerId = useCartStore((s) => s.linkedCustomerId);
  const linkedCustomerName = useCartStore((s) => s.linkedCustomerName);
  const linkedCustomerCreditBalance = useCartStore((s) => s.linkedCustomerCreditBalance);
  const appliedStoreCredit = useCartStore((s) => s.appliedStoreCredit);
  const linkCustomer = useCartStore((s) => s.linkCustomer);
  const unlinkCustomer = useCartStore((s) => s.unlinkCustomer);
  const setAppliedStoreCredit = useCartStore((s) => s.setAppliedStoreCredit);
  const appliedPromotions = useCartStore((s) => s.appliedPromotions);
  const skippedPromotions = useCartStore((s) => s.skippedPromotions);
  const totalPromotionDiscount = useCartStore((s) => s.totalPromotionDiscount);
  const appliedPromoCode = useCartStore((s) => s.appliedPromoCode);
  const setPromoCode = useCartStore((s) => s.setPromoCode);
  const evaluatePromotionsAction = useCartStore((s) => s.evaluatePromotions);

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
  const [promoCodeInput, setPromoCodeInput] = useState('');
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
  const appliedCreditDec = new Decimal(appliedStoreCredit);
  const promoDiscountDec = new Decimal(totalPromotionDiscount);
  const amountDue = total.minus(appliedCreditDec).minus(promoDiscountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const promoCodeError = skippedPromotions.find((s) => s.promotionId === 'promo_code')?.reason;

  const salePayload: CreateSalePayload = {
    shiftId,
    lines: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
    })),
    cartDiscountAmount: discountEffective.toNumber(),
    ...(authorizingManagerId ? { authorizingManagerId } : {}),
    ...(linkedCustomerId ? { customerId: linkedCustomerId } : {}),
    ...(appliedCreditDec.greaterThan(0) ? { appliedStoreCredit } : {}),
    ...(appliedPromotions.length > 0 ? { appliedPromotions } : {}),
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

      {/* Customer linking */}
      <div className="shrink-0 px-4 py-2 border-b border-mist/30">
        {!linkedCustomerId ? (
          <CustomerSearchDropdown
            onSelect={(c) => linkCustomer(c.id, c.name, c.creditBalance)}
            onClear={() => {}}
          />
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-espresso font-medium">{linkedCustomerName}</p>
                {linkedCustomerCreditBalance && new Decimal(linkedCustomerCreditBalance).greaterThan(0) && (
                  <p className="font-body text-xs text-green-700">
                    Store Credit: {formatRupee(linkedCustomerCreditBalance)}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => { unlinkCustomer(); }} className="text-mist hover:text-espresso transition-colors" aria-label="Unlink customer">
                <X className="h-4 w-4" />
              </button>
            </div>
            {linkedCustomerCreditBalance && new Decimal(linkedCustomerCreditBalance).greaterThan(0) && hasItems && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-body text-xs text-espresso">Use Store Credit</span>
                  <span className="font-body text-[10px] text-mist ml-1">
                    ({formatRupee(linkedCustomerCreditBalance)} available)
                  </span>
                </div>
                <Switch
                  checked={new Decimal(appliedStoreCredit).greaterThan(0)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const credit = new Decimal(linkedCustomerCreditBalance);
                      const validAmount = Decimal.min(credit, total).toFixed(2);
                      setAppliedStoreCredit(validAmount);
                    } else {
                      setAppliedStoreCredit('0');
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
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

      {/* Promo code input */}
      {hasItems && (
        <div className="shrink-0 px-4 py-2 border-t border-mist/30">
          {appliedPromoCode ? (
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-terracotta" />
              <span className="font-mono text-xs text-espresso bg-linen px-2 py-1 rounded">{appliedPromoCode}</span>
              <button
                type="button"
                onClick={() => {
                  setPromoCode(null);
                  evaluatePromotionsAction();
                }}
                className="text-mist hover:text-[#9B2226] transition-colors"
                aria-label="Remove promo code"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {promoCodeError && (
                <span className="font-body text-xs text-[#9B2226]">{promoCodeError}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="flex-1 px-2 py-1.5 border border-mist/50 rounded text-xs font-mono bg-pearl text-espresso placeholder:text-mist/50 focus:outline-none focus:border-terracotta"
              />
              <button
                type="button"
                disabled={!promoCodeInput.trim()}
                onClick={() => {
                  if (!promoCodeInput.trim()) return;
                  setPromoCode(promoCodeInput.trim());
                  setPromoCodeInput('');
                  evaluatePromotionsAction();
                }}
                className="px-3 py-1.5 rounded bg-espresso text-pearl text-xs font-body hover:bg-espresso/90 transition-colors disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

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
            {promoDiscountDec.greaterThan(0) && (
              <div className="space-y-0.5">
                <div className="flex justify-between font-body text-sm text-green-700">
                  <span>Promotions</span>
                  <span className="font-mono">-{formatRupee(promoDiscountDec.toNumber())}</span>
                </div>
                {appliedPromotions.map((p) => (
                  <div key={p.promotionId} className="flex justify-between font-body text-xs text-green-600 pl-2">
                    <span className="truncate mr-2">{p.label}</span>
                    <span className="font-mono shrink-0">-{formatRupee(new Decimal(p.discountAmount).toNumber())}</span>
                  </div>
                ))}
              </div>
            )}
            {appliedCreditDec.greaterThan(0) && (
              <div className="flex justify-between font-body text-sm text-green-700">
                <span>Store Credit</span>
                <span className="font-mono">-{formatRupee(appliedStoreCredit)}</span>
              </div>
            )}
            <div className="flex justify-between font-body text-sm text-espresso">
              <span>Tax {taxRate > 0 ? `(${taxRate}%)` : ''}</span>
              <span className="font-mono">{formatRupee(taxAmount.toNumber())}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1.5 border-t border-mist/30">
              <span className="font-display text-lg text-espresso font-bold">Total</span>
              <span className="font-mono text-lg text-terracotta font-bold">
                {formatRupee(amountDue.toNumber())}
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
        totalAmount={amountDue}
        salePayload={salePayload}
      />
      <CardPaymentModal
        open={paymentMode === 'card'}
        onClose={() => setPaymentMode(null)}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
        salePayload={salePayload}
      />
      <SplitPaymentModal
        open={paymentMode === 'split'}
        onClose={() => setPaymentMode(null)}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
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
