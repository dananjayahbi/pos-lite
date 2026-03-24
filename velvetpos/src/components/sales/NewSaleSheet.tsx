'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatRupee } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: string;
  sku: string;
  size: string | null;
  colour: string | null;
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

  const { data: shiftData, isLoading: shiftLoading } = useQuery({
    queryKey: ['currentShift'],
    queryFn: async () => {
      const res = await fetch('/api/store/shifts/current');
      const json = (await res.json()) as { success: boolean; data: { id: string; status: string } | null };
      return json.data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: products, isFetching: searchLoading } = useQuery({
    queryKey: ['productSearch', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ search: debouncedSearch, isArchived: 'false', limit: '12' });
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
    const desc = [variant.size, variant.colour].filter(Boolean).join(' / ') || 'Default';
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
      if (!shiftData?.id) throw new Error('No open shift');
      const body: Record<string, unknown> = {
        shiftId: shiftData.id,
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

  const hasOpenShift = shiftData != null;
  const cashNum = parseFloat(cashReceived) || 0;
  const cardNum = parseFloat(cardAmount) || 0;

  const isPaymentValid =
    cart.length > 0 &&
    (paymentMethod === 'CASH'
      ? cashNum >= total
      : paymentMethod === 'CARD'
        ? true
        : cashNum > 0 && cardNum > 0 && cashNum + cardNum >= total);

  const canSubmit = hasOpenShift && isPaymentValid && !isPending;

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
          {/* Shift status */}
          {!shiftLoading && !hasOpenShift && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No open shift. Open a shift in the POS terminal first.
            </div>
          )}

          {/* Product search */}
          <div className="relative" ref={dropdownRef}>
            <Label htmlFor="product-search" className="mb-1.5 block text-xs font-semibold text-espresso">
              Add Products
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand" />
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
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sand" />
              )}
            </div>

            {showDropdown && debouncedSearch.length >= 2 && products && products.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-mist bg-white shadow-lg">
                {products.flatMap((product) =>
                  product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => addVariant(product, variant)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-linen"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-espresso">{product.name}</span>
                        {(variant.size ?? variant.colour) && (
                          <span className="ml-1.5 text-xs text-sand">
                            {[variant.size, variant.colour].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        <span className="ml-1.5 text-xs text-sand/60">{variant.sku}</span>
                      </div>
                      <span className="ml-3 shrink-0 text-sm font-semibold text-espresso">
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
            <div className="rounded-lg border border-mist divide-y divide-mist/40">
              {cart.map((item) => (
                <div key={item.variantId} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-espresso">{item.productName}</p>
                    <p className="text-xs text-sand">
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
                              i.variantId === item.variantId ? { ...i, quantity: i.quantity - 1 } : i,
                            )
                            .filter((i) => i.quantity > 0),
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-mist text-sand transition-colors hover:border-terracotta hover:text-terracotta"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-espresso">
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
                      className="flex h-6 w-6 items-center justify-center rounded border border-mist text-sand transition-colors hover:border-terracotta hover:text-terracotta"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-espresso">
                    {formatRupee(item.unitPrice * item.quantity * (1 - item.discountPercent / 100))}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCart((prev) => prev.filter((i) => i.variantId !== item.variantId))}
                    className="shrink-0 text-sand transition-colors hover:text-terracotta"
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
                <Label htmlFor="cart-discount" className="shrink-0 text-xs font-semibold text-espresso">
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
              <dl className="divide-y divide-mist/40 rounded-lg border border-mist text-sm">
                <div className="flex justify-between px-3 py-1.5">
                  <dt className="text-sand">Subtotal</dt>
                  <dd className="font-medium text-espresso">{formatRupee(cartSubtotal)}</dd>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between px-3 py-1.5 text-terracotta">
                    <dt>Discount</dt>
                    <dd>−{formatRupee(discountAmt)}</dd>
                  </div>
                )}
                <div className="flex justify-between px-3 py-2">
                  <dt className="font-semibold text-espresso">Total</dt>
                  <dd className="text-base font-bold text-espresso">{formatRupee(total)}</dd>
                </div>
              </dl>

              {/* Payment method */}
              <div>
                <Label className="mb-2 block text-xs font-semibold text-espresso">Payment Method</Label>
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
                  <Label htmlFor="cash-received" className="mb-1.5 block text-xs font-semibold text-espresso">
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
                    <p className="mt-1 text-xs text-sand">
                      Change: <span className="font-medium text-espresso">{formatRupee(cashNum - total)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Card amount (SPLIT) */}
              {paymentMethod === 'SPLIT' && (
                <div>
                  <Label htmlFor="card-amount" className="mb-1.5 block text-xs font-semibold text-espresso">
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
                  <Label htmlFor="card-ref" className="mb-1.5 block text-xs font-semibold text-espresso">
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
