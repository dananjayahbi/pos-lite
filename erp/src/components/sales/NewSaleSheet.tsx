'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatRupee } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: string;
  sku: string;
  form: string | null;
  packSize: string | null;
  stockQuantity: number;
  retailPrice: string;
}

interface Product {
  id: string;
  name: string;
  variants: ProductVariant[];
}

interface CartItem {
  variantId: string;
  productName: string;
  variantDesc: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
}

type PaymentMethod = 'CASH' | 'CARD' | 'SPLIT';

interface NewSaleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewSaleSheet({ open, onOpenChange, onSuccess }: NewSaleSheetProps) {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [cardAmount, setCardAmount] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { data: products, isFetching: searchLoading } = useQuery({
    queryKey: ['productSearch', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        isArchived: 'false',
        limit: '12',
      });
      const res = await fetch(`/api/store/products?${params.toString()}`);
      const json = (await res.json()) as { success: boolean; data?: Product[] };
      return json.data ?? [];
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 10_000,
  });

  const cartSubtotal = cart.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity * (1 - item.discountPercent / 100);
  }, 0);
  const discountAmt = Math.min(parseFloat(cartDiscount) || 0, cartSubtotal);
  const total = cartSubtotal - discountAmt;

  const addVariant = useCallback((product: Product, variant: ProductVariant) => {
    const desc = [variant.form, variant.packSize].filter(Boolean).join(' / ') || 'Default';
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: product.name,
          variantDesc: desc,
          sku: variant.sku,
          unitPrice: parseFloat(variant.retailPrice),
          quantity: 1,
          discountPercent: 0,
        },
      ];
    });
    setSearch('');
    setShowDropdown(false);
  }, []);

  const { mutate: submitSale, isPending } = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        lines: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          discountPercent: i.discountPercent,
        })),
        cartDiscountAmount: discountAmt,
        paymentMethod,
      };
      if (paymentMethod === 'CASH') {
        body.cashReceived = parseFloat(cashReceived);
      }
      if (paymentMethod === 'CARD' && cardRef.trim()) {
        body.cardReferenceNumber = cardRef.trim();
      }
      if (paymentMethod === 'SPLIT') {
        body.cashReceived = parseFloat(cashReceived);
        body.cardAmount = parseFloat(cardAmount);
        if (cardRef.trim()) body.cardReferenceNumber = cardRef.trim();
      }

      const res = await fetch('/api/store/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to create sale');
      return json;
    },
    onSuccess: () => {
      toast.success('Sale recorded successfully');
      void qc.invalidateQueries({ queryKey: ['sales'] });
      onSuccess?.();
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create sale');
    },
  });

  function resetForm() {
    setSearch('');
    setCart([]);
    setCartDiscount('');
    setPaymentMethod('CASH');
    setCashReceived('');
    setCardRef('');
    setCardAmount('');
  }

  const cashNum = parseFloat(cashReceived) || 0;
  const cardNum = parseFloat(cardAmount) || 0;

  const isPaymentValid =
    cart.length > 0 &&
    (paymentMethod === 'CASH'
      ? cashNum >= total
      : paymentMethod === 'CARD'
        ? true
        : cashNum > 0 && cardNum > 0 && cashNum + cardNum >= total);

  const canSubmit = isPaymentValid && !isPending;

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
          <SheetTitle className="font-display text-espresso">Record Sale</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {/* Product search */}
          <div className="relative" ref={dropdownRef}>
            <Label
              htmlFor="product-search"
              className="text-espresso mb-1.5 block text-xs font-semibold"
            >
              Add Products
            </Label>
            <div className="relative">
              <Search className="text-sand pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="product-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name or SKU…"
                className="pl-9"
                autoComplete="off"
              />
              {searchLoading && (
                <Loader2 className="text-sand absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
            </div>

            {showDropdown && debouncedSearch.length >= 2 && products && products.length > 0 && (
              <div className="border-mist absolute top-full left-0 z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                {products.flatMap((product) =>
                  product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => addVariant(product, variant)}
                      className="hover:bg-linen flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="text-espresso font-medium">{product.name}</span>
                        {(variant.form ?? variant.packSize) && (
                          <span className="text-sand ml-1.5 text-xs">
                            {[variant.form, variant.packSize].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        <span className="text-sand/60 ml-1.5 text-xs">{variant.sku}</span>
                      </div>
                      <span className="text-espresso ml-3 shrink-0 text-sm font-semibold">
                        {formatRupee(parseFloat(variant.retailPrice))}
                      </span>
                    </button>
                  )),
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="border-mist divide-mist/40 divide-y rounded-lg border">
              {cart.map((item) => (
                <div key={item.variantId} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-espresso truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-sand text-xs">
                      {item.variantDesc} · {item.sku}
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((i) =>
                              i.variantId === item.variantId
                                ? { ...i, quantity: i.quantity - 1 }
                                : i,
                            )
                            .filter((i) => i.quantity > 0),
                        )
                      }
                      className="border-mist text-sand hover:border-terracotta hover:text-terracotta flex h-6 w-6 items-center justify-center rounded border transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-espresso w-6 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((i) =>
                            i.variantId === item.variantId ? { ...i, quantity: i.quantity + 1 } : i,
                          ),
                        )
                      }
                      className="border-mist text-sand hover:border-terracotta hover:text-terracotta flex h-6 w-6 items-center justify-center rounded border transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="text-espresso w-20 shrink-0 text-right text-sm font-semibold">
                    {formatRupee(item.unitPrice * item.quantity * (1 - item.discountPercent / 100))}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCart((prev) => prev.filter((i) => i.variantId !== item.variantId))
                    }
                    className="text-sand hover:text-terracotta shrink-0 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <>
              {/* Cart discount */}
              <div className="flex items-center gap-3">
                <Label
                  htmlFor="cart-discount"
                  className="text-espresso shrink-0 text-xs font-semibold"
                >
                  Cart Discount (LKR)
                </Label>
                <Input
                  id="cart-discount"
                  type="number"
                  min="0"
                  step="1"
                  value={cartDiscount}
                  onChange={(e) => setCartDiscount(e.target.value)}
                  className="h-8 text-right"
                  placeholder="0"
                />
              </div>

              {/* Totals */}
              <dl className="divide-mist/40 border-mist divide-y rounded-lg border text-sm">
                <div className="flex justify-between px-3 py-1.5">
                  <dt className="text-sand">Subtotal</dt>
                  <dd className="text-espresso font-medium">{formatRupee(cartSubtotal)}</dd>
                </div>
                {discountAmt > 0 && (
                  <div className="text-terracotta flex justify-between px-3 py-1.5">
                    <dt>Discount</dt>
                    <dd>−{formatRupee(discountAmt)}</dd>
                  </div>
                )}
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-espresso font-semibold">Total</dt>
                  <dd className="text-espresso text-base font-bold">{formatRupee(total)}</dd>
                </div>
              </dl>

              {/* Payment method */}
              <div>
                <Label className="text-espresso mb-2 block text-xs font-semibold">
                  Payment Method
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'CARD', 'SPLIT'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`rounded-md border py-2 text-sm font-medium transition-colors ${
                        paymentMethod === m
                          ? 'border-terracotta bg-terracotta/10 text-terracotta'
                          : 'border-mist text-sand hover:border-terracotta/50 hover:text-espresso'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash received */}
              {(paymentMethod === 'CASH' || paymentMethod === 'SPLIT') && (
                <div>
                  <Label
                    htmlFor="cash-received"
                    className="text-espresso mb-1.5 block text-xs font-semibold"
                  >
                    Cash Received (LKR)
                  </Label>
                  <Input
                    id="cash-received"
                    type="number"
                    min="0"
                    step="1"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={`e.g. ${Math.ceil(total)}`}
                  />
                  {paymentMethod === 'CASH' && cashNum >= total && cashNum > 0 && (
                    <p className="text-sand mt-1 text-xs">
                      Change:{' '}
                      <span className="text-espresso font-medium">
                        {formatRupee(cashNum - total)}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Card amount (SPLIT) */}
              {paymentMethod === 'SPLIT' && (
                <div>
                  <Label
                    htmlFor="card-amount"
                    className="text-espresso mb-1.5 block text-xs font-semibold"
                  >
                    Card Amount (LKR)
                  </Label>
                  <Input
                    id="card-amount"
                    type="number"
                    min="0"
                    step="1"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                  />
                </div>
              )}

              {/* Card reference */}
              {(paymentMethod === 'CARD' || paymentMethod === 'SPLIT') && (
                <div>
                  <Label
                    htmlFor="card-ref"
                    className="text-espresso mb-1.5 block text-xs font-semibold"
                  >
                    Card Reference{paymentMethod === 'CARD' ? ' (optional)' : ''}
                  </Label>
                  <Input
                    id="card-ref"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="Approval / reference number"
                    maxLength={20}
                  />
                </div>
              )}
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
            onClick={() => submitSale()}
            disabled={!canSubmit}
            className="bg-espresso text-pearl hover:bg-espresso/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Sale
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
