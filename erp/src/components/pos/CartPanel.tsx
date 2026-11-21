'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArchiveRestore, UserPlus, X, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { formatRupee } from '@/lib/format';
import { useCartStore, getCartTotal } from '@/stores/cartStore';
import { summarizeCartDiscounts } from '@/components/pos/cartDiscountSummary';
import { createCartPromotionSnapshot } from '@/stores/cartPromotions';
import { CartLineItems } from '@/components/pos/CartLineItems';
import { CartDiscountControl } from '@/components/pos/CartDiscountControl';
import { HoldSaleButton } from '@/components/pos/HoldSaleButton';
import { RetrieveHeldSalesSheet } from '@/components/pos/RetrieveHeldSalesSheet';
import { PaymentMethodModal } from '@/components/pos/PaymentMethodModal';
import type { PaymentMethodMode } from '@/components/pos/PaymentMethodModal';
import { CashPaymentModal } from '@/components/pos/CashPaymentModal';
import { CardPaymentModal } from '@/components/pos/CardPaymentModal';
import { SplitPaymentModal } from '@/components/pos/SplitPaymentModal';
import { LankaQRPaymentModal } from '@/components/pos/LankaQRPaymentModal';
import { ZeroValuePaymentModal } from '@/components/pos/ZeroValuePaymentModal';
import { CreditCoverPaymentModal } from '@/components/pos/CreditCoverPaymentModal';
import { AddCustomerDialog } from '@/components/pos/AddCustomerDialog';
import { ReceiptPreviewDialog } from '@/components/pos/ReceiptPreviewDialog';
import type { CreateSalePayload, CompletedSale } from '@/types/pos.types';
import type { LankaQrSettings } from '@/lib/payments/lanka-qr-config';
import { DEFAULT_LANKA_QR_SETTINGS } from '@/lib/payments/lanka-qr-config';
import { CustomerSearchDropdown } from '@/components/customers/CustomerSearchDropdown';
import { Switch } from '@/components/ui/switch';
import { usePersistCartEffect } from '@/hooks/usePersistCartEffect';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';
import { focusPOSBarcodeInput, isPOSDialogOpen } from '@/lib/pos/keyboard';
import { clearCartSnapshot } from '@/lib/idb-store';

interface CartPanelProps {
  shiftId: string;
  /** Tenant LankaQR configuration; defaults keep the tender available. */
  lankaQr?: LankaQrSettings | undefined;
  /**
   * When false the line-item list is not rendered. The keyboard-only console
   * shows the ticket in its page-wide left column and keeps this rail for the
   * customer, discounts, totals and pay actions only.
   */
  showLineItems?: boolean;
}

export function CartPanel({
  shiftId,
  lankaQr = DEFAULT_LANKA_QR_SETTINGS,
  showLineItems = true,
}: CartPanelProps) {
  const items = useCartStore((s) => s.items);
  const cartDiscountPercent = useCartStore((s) => s.cartDiscountPercent);
  const cartDiscountAmount = useCartStore((s) => s.cartDiscountAmount);
  const vatRate = useCartStore((s) => s.vatRate);
  const ssclRate = useCartStore((s) => s.ssclRate);
  const setTaxRates = useCartStore((s) => s.setTaxRates);
  const clearCart = useCartStore((s) => s.clearCart);
  const authorizingManagerId = useCartStore((s) => s.authorizingManagerId);
  const linkedCustomerId = useCartStore((s) => s.linkedCustomerId);
  const linkedCustomerName = useCartStore((s) => s.linkedCustomerName);
  const linkedCustomerPhone = useCartStore((s) => s.linkedCustomerPhone);
  const linkedCustomerCreditBalance = useCartStore((s) => s.linkedCustomerCreditBalance);
  const appliedStoreCredit = useCartStore((s) => s.appliedStoreCredit);
  const linkedReturnId = useCartStore((s) => s.linkedReturnId);
  const exchangeCredit = useCartStore((s) => s.exchangeCredit);
  const exchangeReturnRef = useCartStore((s) => s.exchangeReturnRef);
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
  usePersistCartEffect({
    items,
    cartDiscountPercent,
    cartDiscountAmount,
    promotions: {
      appliedPromotions,
      skippedPromotions,
      totalPromotionDiscount,
      appliedPromoCode,
    },
    exchange:
      linkedReturnId !== null && exchangeCredit !== null && exchangeReturnRef !== null
        ? { returnId: linkedReturnId, credit: exchangeCredit, ref: exchangeReturnRef }
        : null,
  });

  const { subtotal, discountEffective, promotionDiscount, saleDiscount, taxAmount, taxRatesApplied, total } = getCartTotal(
    items,
    cartDiscountPercent,
    cartDiscountAmount,
    { vatRate, ssclRate },
    totalPromotionDiscount,
  );

  const discountSummary = summarizeCartDiscounts({
    items,
    subtotal,
    manualDiscount: discountEffective,
    promotionDiscount,
    cartDiscountPercent,
    promoCode: appliedPromoCode,
  });

  const [retrieveOpen, setRetrieveOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'split' | 'lankaqr' | null>(null);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [zeroValueOpen, setZeroValueOpen] = useState(false);
  const [storeCreditOpen, setStoreCreditOpen] = useState(false);
  const [exchangeCreditOpen, setExchangeCreditOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [changeAmount, setChangeAmount] = useState<Decimal | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const promoInputRef = useRef<HTMLInputElement>(null);
  // Discount + promo share one collapsible section (UI update #10); the state
  // lives here so Alt+P can expand it before focusing the promo field.
  const [discountExpanded, setDiscountExpanded] = useState(false);
  const focusPromoAfterExpand = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (discountExpanded && focusPromoAfterExpand.current) {
      focusPromoAfterExpand.current = false;
      promoInputRef.current?.focus();
    }
  }, [discountExpanded]);

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

  // Tenant VAT/SSCL rates. The cart computes tax per line with the product's
  // tax rule, exactly like the sales API, so the Tax row and Total here match
  // what is persisted when the sale is charged.
  const { data: tenantTaxRates } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: async () => {
      const res = await fetch('/api/settings/taxes');
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as { vatRate: number; ssclRate: number } | null;
    },
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (tenantTaxRates) setTaxRates(tenantTaxRates.vatRate, tenantTaxRates.ssclRate);
  }, [tenantTaxRates, setTaxRates]);
  const taxLabel =
    taxRatesApplied.length === 1 ? `Tax (${taxRatesApplied[0]}%)` : 'Tax';

  const hasItems = items.length > 0;
  // Guest-by-default (task "Walk-In customer issue"): a POS sale no longer
  // requires a customer. An unlinked cart is a guest sale — the cashier can
  // optionally attribute it by picking an existing customer or adding one.
  // A linked customer must still carry a phone, otherwise it is not usable.
  const isGuestSale = !linkedCustomerId;
  const hasValidCustomer = isGuestSale || !!linkedCustomerPhone;
  const totalDiscount = discountEffective.toNumber();
  const appliedCreditDec = new Decimal(appliedStoreCredit);
  // Exchange credit from a linked return applies after store credit, mirroring
  // the API (which also issues any remainder as store credit).
  const exchangeCreditDec = new Decimal(exchangeCredit ?? 0);
  const exchangeApplied = Decimal.min(
    exchangeCreditDec,
    Decimal.max(total.minus(appliedCreditDec), 0),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  // `total` already nets the manual cart discount, promotions and the tax on
  // what is actually charged, so only store credit and exchange credit remain.
  const amountDue = total
    .minus(appliedCreditDec)
    .minus(exchangeApplied)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  // Zero-value gate (doc 33): only a genuinely zero (or negative) SALE value
  // needs the reason-selection flow. A sale fully covered by credit is a paid
  // sale — it is confirmed through the matching credit tender instead.
  const isZeroValue = hasItems && total.lte(0);
  const isExchangeCovered =
    hasItems && !isZeroValue && exchangeApplied.greaterThan(0) && amountDue.lte(0);
  const isCreditCovered =
    hasItems &&
    !isZeroValue &&
    !isExchangeCovered &&
    appliedCreditDec.greaterThan(0) &&
    amountDue.lte(0);
  const promoCodeError = appliedPromoCode
    ? skippedPromotions.find((s) => !appliedPromotions.some((a) => a.promotionId === s.promotionId))?.reason
    : undefined;

  // Recap store credit when items change or promotions update
  useEffect(() => {
    if (appliedCreditDec.lte(0)) return;
    if (appliedCreditDec.greaterThan(total)) {
      setAppliedStoreCredit(Decimal.max(0, total).toDecimalPlaces(2).toFixed(2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total.toString()]);

  const salePayload: CreateSalePayload = {
    shiftId,
    lines: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      discountPercent: Number(item.discountPercent),
      ...(item.categoryId ? { categoryId: item.categoryId } : {}),
    })),
    // ISSUE 7: promotions are a real discount, and the API only knows one
    // discount field. Sending the cart discount alone persisted a promotion-
    // discounted sale at full price and made a promotion-zeroed cart fail as a
    // non-zero NONE tender, so both are folded into `cartDiscountAmount`.
    cartDiscountAmount: saleDiscount.toNumber(),
    manualCartDiscountAmount: discountEffective.toNumber(),
    ...(authorizingManagerId ? { authorizingManagerId } : {}),
    ...(linkedCustomerId ? { customerId: linkedCustomerId } : { isGuestSale: true }),
    ...(appliedCreditDec.greaterThan(0) ? { appliedStoreCredit } : {}),
    ...(linkedReturnId ? { linkedReturnId } : {}),
    ...(appliedPromotions.length > 0 ? { appliedPromotions } : {}),
    ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
  };

  const handleSaleComplete = (sale: CompletedSale) => {
    setCompletedSale(sale);
    const change = sale.changeGiven != null ? new Decimal(sale.changeGiven) : null;
    setChangeAmount(change);
    setPaymentMode(null);
    setReceiptOpen(true);
    // Clear the cart as soon as the sale is committed rather than only on the
    // explicit "New Sale" button. The receipt dialog can be dismissed any other
    // way (X, backdrop, Esc) and the cashier may navigate straight back to the
    // grid — without this the sold items stay in the cart and get charged twice.
    clearCart();
    clearCartSnapshot('ayurpos_cart_default').catch(() => {});
    setDiscountExpanded(false);
    setPromoCodeInput('');
    toast.success(`Sale completed - ${formatRupee(sale.totalAmount)}`);
  };

  const handleNewSale = () => {
    setReceiptOpen(false);
    setCompletedSale(null);
    setChangeAmount(null);
    setDiscountExpanded(false);
    setPromoCodeInput('');
    queryClient.invalidateQueries({ queryKey: ['held-sales-count'] });
    focusPOSBarcodeInput();
  };

  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setCompletedSale(null);
    setChangeAmount(null);
    focusPOSBarcodeInput();
  };

  const handlePaymentClose = useCallback(() => {
    setPaymentMode(null);
    focusPOSBarcodeInput();
  }, []);

  const handleClearCart = () => {
    const snapshot = [...items];
    const snapDiscPct = cartDiscountPercent;
    const snapDiscAmt = cartDiscountAmount;
    // Capture the promotion state too — clearCart() drops it, so undo has to
    // put it back or the restored cart shows no promotions and full price.
    const snapPromotions = createCartPromotionSnapshot({
      appliedPromotions,
      skippedPromotions,
      totalPromotionDiscount,
      appliedPromoCode,
    });
    clearCart();
    clearCartSnapshot('ayurpos_cart_default').catch(() => {});
    setDiscountExpanded(false);
    setPromoCodeInput('');
    toast('Cart cleared', {
      action: {
        label: 'Undo',
        onClick: () => {
          useCartStore.getState().restoreCartWithPromotions({
            items: snapshot,
            cartDiscountPercent: snapDiscPct,
            cartDiscountAmount: snapDiscAmt,
            promotions: snapPromotions,
          });
        },
      },
      duration: 3000,
    });
  };

  // Keyboard-first payment entry: `F4` (or the Charge / Pay button) opens the
  // tender dialog; zero-value carts go straight to the reason flow.
  const openPayment = () => {
    if (isPOSDialogOpen()) return;
    if (!hasItems || !hasValidCustomer) return;
    if (isZeroValue) {
      setZeroValueOpen(true);
      return;
    }
    if (isExchangeCovered) {
      setExchangeCreditOpen(true);
      return;
    }
    if (isCreditCovered) {
      setStoreCreditOpen(true);
      return;
    }
    setPaymentMethodOpen(true);
  };

  const handlePaymentMethodSelect = (mode: PaymentMethodMode) => {
    setPaymentMethodOpen(false);
    setPaymentMode(mode);
  };

  const applyPromoCode = useCallback(() => {
    const code = promoCodeInput.trim();
    if (!code) {
      focusPOSBarcodeInput();
      return;
    }
    setPromoCode(code);
    setPromoCodeInput('');
    evaluatePromotionsAction();
    // The promo field is a temporary focus owner: hand the keyboard back to
    // the barcode box as soon as the code is submitted.
    focusPOSBarcodeInput();
  }, [promoCodeInput, setPromoCode, evaluatePromotionsAction]);

  const removePromoCode = () => {
    setPromoCode(null);
    evaluatePromotionsAction();
    focusPOSBarcodeInput();
  };

  usePOSShortcuts([
    {
      key: 'F4',
      allowInEditable: true,
      handler: openPayment,
    },
    {
      key: 'F9',
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen() || heldCount === 0) return;
        setRetrieveOpen(true);
      },
    },
    {
      key: 'C',
      alt: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        document.getElementById('pos-customer-search')?.focus();
      },
    },
    {
      key: 'A',
      alt: true,
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        setAddCustomerOpen(true);
      },
    },
    {
      key: 'U',
      alt: true,
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen() || !linkedCustomerId) return;
        unlinkCustomer();
        focusPOSBarcodeInput();
      },
    },
    {
      key: 'P',
      alt: true,
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen() || !hasItems) return;
        if (!discountExpanded) {
          // The promo field lives inside the collapsible section: open it and
          // hand the cursor over once the input has mounted.
          focusPromoAfterExpand.current = true;
          setDiscountExpanded(true);
          return;
        }
        promoInputRef.current?.focus();
      },
    },
  ]);

  return (
    <div className="flex flex-col h-full bg-pearl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] shrink-0 border-b border-mist/50">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base text-espresso">
            {showLineItems ? 'Cart' : 'Current sale'}
          </h2>
          {hasItems && showLineItems && (
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
              className="flex min-h-11 items-center gap-1 px-1 font-body text-xs text-terracotta hover:text-espresso transition-colors"
              title="Retrieve a held sale (F9)"
              aria-keyshortcuts="F9"
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
              className="inline-flex min-h-11 items-center px-1 font-body text-xs text-[#9B2226] hover:text-[#9B2226]/80 transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* Customer linking */}
      <div className="shrink-0 px-4 py-2 border-b border-mist/30">
        {!linkedCustomerId ? (
          <div className="space-y-1.5">
            <CustomerSearchDropdown
              inputId="pos-customer-search"
              onSelect={(c) => {
                linkCustomer(c.id, c.name, c.phone, c.creditBalance);
                focusPOSBarcodeInput();
              }}
              onCancel={() => focusPOSBarcodeInput()}
            />
            <button
              type="button"
              onClick={() => setAddCustomerOpen(true)}
              aria-keyshortcuts="Alt+A"
              title="Add a customer (Alt+A)"
              className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-sand px-3 py-1.5 font-body text-xs text-sand-ink hover:text-espresso hover:border-terracotta transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Customer
            </button>
            <p className="text-center font-body text-[11px] text-mist-ink">
              No customer selected - this will be billed as a guest sale.
            </p>
          </div>
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
              <button type="button" onClick={() => { unlinkCustomer(); }} className="text-mist-ink hover:text-espresso transition-colors" aria-label="Unlink customer" aria-keyshortcuts="Alt+U" title="Unlink customer (Alt+U)">
                <X className="h-4 w-4" />
              </button>
            </div>
            {linkedCustomerCreditBalance && new Decimal(linkedCustomerCreditBalance).greaterThan(0) && hasItems && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-body text-xs text-espresso">Use Store Credit</span>
                  <span className="font-body text-[10px] text-mist-ink ml-1">
                    ({formatRupee(linkedCustomerCreditBalance)} available)
                  </span>
                </div>
                <Switch
                  checked={new Decimal(appliedStoreCredit).greaterThan(0)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const credit = new Decimal(linkedCustomerCreditBalance);
                      const validAmount = Decimal.min(credit, total).toDecimalPlaces(2).toFixed(2);
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

      {/* Line items (scrollable). Hidden when the ticket lives in the
          keyboard console's left column. */}
      {showLineItems ? (
        <CartLineItems className="flex-1 overflow-y-auto" />
      ) : (
        <div className="flex-1" aria-hidden="true" />
      )}

      {/* Discounts & promo — one collapsible section so both reclaim space */}
      {hasItems && (
        <CartDiscountControl
          expanded={discountExpanded}
          onExpandedChange={(next) => {
            setDiscountExpanded(next);
            if (!next) setPromoCodeInput('');
          }}
          activePromoCode={appliedPromoCode}
          discountSummary={discountSummary}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-body text-[11px] font-medium uppercase tracking-wide text-mist-ink">
                <Tag className="h-3 w-3" aria-hidden="true" />
                Promo code
              </span>
              {appliedPromoCode && (
                <button
                  type="button"
                  onClick={removePromoCode}
                  className="font-body text-[11px] text-[#9B2226] transition-colors hover:text-[#9B2226]/80"
                  aria-label="Remove promo code"
                >
                  Remove
                </button>
              )}
            </div>

            {appliedPromoCode ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-linen px-2 py-1 font-mono text-xs text-espresso">
                  {appliedPromoCode}
                </span>
                <span className="font-body text-[11px] text-[#2D6A4F]">
                  Applied to this sale
                </span>
                {promoCodeError && (
                  <span className="font-body text-xs text-[#9B2226]">{promoCodeError}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={promoInputRef}
                  id="pos-promo-code-input"
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyPromoCode();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setPromoCodeInput('');
                      focusPOSBarcodeInput();
                    }
                  }}
                  placeholder="Promo code (Alt+P)"
                  aria-keyshortcuts="Alt+P"
                  className="min-w-0 flex-1 rounded border border-mist/50 bg-pearl px-2 py-1.5 font-mono text-xs text-espresso placeholder:text-mist-ink/50 focus:border-terracotta focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!promoCodeInput.trim()}
                  onClick={applyPromoCode}
                  className="min-h-10 rounded bg-espresso px-3 py-1.5 font-body text-xs text-pearl transition-colors hover:bg-espresso/90 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </CartDiscountControl>
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
            {promotionDiscount.greaterThan(0) && (
              <div className="space-y-0.5">
                <div className="flex justify-between font-body text-sm text-green-700">
                  <span>Promotions</span>
                  <span className="font-mono">-{formatRupee(promotionDiscount.toNumber())}</span>
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
            {exchangeApplied.greaterThan(0) && (
              <div className="flex justify-between font-body text-sm text-green-700">
                <span>
                  Exchange credit
                  {exchangeReturnRef ? ` (${exchangeReturnRef})` : ''}
                </span>
                <span className="font-mono">-{formatRupee(exchangeApplied.toNumber())}</span>
              </div>
            )}
            <div className="flex justify-between font-body text-sm text-espresso">
              <span>{taxLabel}</span>
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
            {hasItems && !isGuestSale && !hasValidCustomer && (
              <p className="rounded-md bg-[#FCE9E8] px-3 py-2 text-center font-body text-xs text-[#9B2226]">
                The linked customer has no mobile number - unlink them to bill as
                a guest, or add a new customer.
              </p>
            )}
            <HoldSaleButton shiftId={shiftId} />
            {isZeroValue ? (
              <button
                type="button"
                disabled={!hasValidCustomer}
                onClick={() => setZeroValueOpen(true)}
                aria-keyshortcuts="F4"
                className="min-h-12 w-full rounded-lg bg-terracotta py-3 font-body text-base font-bold text-pearl transition-colors hover:bg-terracotta/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Zero-Value Sale
              </button>
            ) : isExchangeCovered ? (
              <button
                type="button"
                disabled={!hasItems || !hasValidCustomer}
                onClick={() => setExchangeCreditOpen(true)}
                aria-keyshortcuts="F4"
                title="Complete the exchange (F4)"
                className="min-h-12 w-full rounded-lg bg-[#2D6A4F] py-3 font-body text-base font-bold text-pearl transition-colors hover:bg-[#2D6A4F]/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Complete Exchange
              </button>
            ) : isCreditCovered ? (
              <button
                type="button"
                disabled={!hasItems || !hasValidCustomer}
                onClick={() => setStoreCreditOpen(true)}
                aria-keyshortcuts="F4"
                title="Complete with store credit (F4)"
                className="min-h-12 w-full rounded-lg bg-[#2D6A4F] py-3 font-body text-base font-bold text-pearl transition-colors hover:bg-[#2D6A4F]/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Complete with Store Credit
              </button>
            ) : (
              <button
                type="button"
                disabled={!hasItems || !hasValidCustomer}
                onClick={() => setPaymentMethodOpen(true)}
                aria-keyshortcuts="F4"
                title="Charge / Pay (F4)"
                className="min-h-12 w-full rounded-lg bg-espresso py-3 font-body text-base font-bold text-pearl transition-colors hover:bg-espresso/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Charge / Pay
              </button>
            )}
          </div>
        </div>
      )}
      <RetrieveHeldSalesSheet
        shiftId={shiftId}
        open={retrieveOpen}
        onOpenChange={(open) => {
          setRetrieveOpen(open);
          if (!open) focusPOSBarcodeInput();
        }}
      />
      <PaymentMethodModal
        open={paymentMethodOpen}
        onClose={() => {
          setPaymentMethodOpen(false);
          focusPOSBarcodeInput();
        }}
        onSelect={handlePaymentMethodSelect}
        allowLankaQr={lankaQr.enabled}
        totalLabel={formatRupee(amountDue.toNumber())}
      />
      <CashPaymentModal
        open={paymentMode === 'cash'}
        onClose={handlePaymentClose}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
        salePayload={salePayload}
      />
      <CardPaymentModal
        open={paymentMode === 'card'}
        onClose={handlePaymentClose}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
        salePayload={salePayload}
      />
      <SplitPaymentModal
        open={paymentMode === 'split'}
        onClose={handlePaymentClose}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
        salePayload={salePayload}
        allowLankaQr={lankaQr.enabled && lankaQr.allowSplit}
      />
      <LankaQRPaymentModal
        open={paymentMode === 'lankaqr'}
        onClose={handlePaymentClose}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
        salePayload={salePayload}
        settings={lankaQr}
      />
      <ZeroValuePaymentModal
        open={zeroValueOpen}
        onClose={() => {
          setZeroValueOpen(false);
          focusPOSBarcodeInput();
        }}
        onSaleComplete={handleSaleComplete}
        totalAmount={amountDue}
        salePayload={salePayload}
      />
      <CreditCoverPaymentModal
        open={storeCreditOpen}
        onClose={() => {
          setStoreCreditOpen(false);
          focusPOSBarcodeInput();
        }}
        onSaleComplete={handleSaleComplete}
        method="STORE_CREDIT"
        creditLabel="Store credit applied"
        saleTotal={total}
        creditAmount={appliedCreditDec}
        salePayload={salePayload}
      />
      <CreditCoverPaymentModal
        open={exchangeCreditOpen}
        onClose={() => {
          setExchangeCreditOpen(false);
          focusPOSBarcodeInput();
        }}
        onSaleComplete={handleSaleComplete}
        method="EXCHANGE_CREDIT"
        creditLabel="Exchange credit applied"
        saleTotal={total}
        creditAmount={exchangeApplied}
        salePayload={salePayload}
      />
      <AddCustomerDialog
        open={addCustomerOpen}
        onOpenChange={(open) => {
          setAddCustomerOpen(open);
          if (!open) focusPOSBarcodeInput();
        }}
        onLinked={(c) => {
          setAddCustomerOpen(false);
          linkCustomer(c.id, c.name, c.phone, c.creditBalance);
          focusPOSBarcodeInput();
        }}
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
