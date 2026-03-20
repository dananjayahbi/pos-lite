'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRupee } from '@/lib/format';
import { useCartStore } from '@/stores/cartStore';

interface RetrieveHeldSalesSheetProps {
  shiftId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SaleLine {
  variantId: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
}

interface HeldSale {
  id: string;
  totalAmount: number;
  discountAmount: number;
  createdAt: string;
  lines: SaleLine[];
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RetrieveHeldSalesSheet({
  shiftId,
  open,
  onOpenChange,
}: RetrieveHeldSalesSheetProps) {
  const queryClient = useQueryClient();
  const replaceCart = useCartStore((s) => s.replaceCart);
  const [confirmSale, setConfirmSale] = useState<HeldSale | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['held-sales', shiftId],
    queryFn: async () => {
      const res = await fetch(
        `/api/store/sales?shiftId=${shiftId}&status=OPEN&limit=50`,
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as HeldSale[];
    },
    enabled: open,
  });

  const sales = useMemo(() => data ?? [], [data]);

  async function holdCurrentCart(): Promise<boolean> {
    const state = useCartStore.getState();
    try {
      const res = await fetch('/api/store/sales/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          lines: state.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            discountPercent: i.discountPercent,
            productNameSnapshot: i.productName,
            variantDescriptionSnapshot: i.variantDescription,
            sku: i.sku,
            unitPrice: i.unitPrice,
          })),
          cartDiscountAmount: state.cartDiscountAmount,
          cartDiscountPercent: state.cartDiscountPercent,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function retrieveSale(sale: HeldSale) {
    const cartItems = useCartStore.getState().items;

    if (cartItems.length > 0) {
      setConfirmSale(sale);
      return;
    }

    applyToCart(sale);
  }

  async function handleConfirmRetrieve() {
    if (!confirmSale) return;

    setSaving(true);
    const held = await holdCurrentCart();
    setSaving(false);

    if (!held) {
      toast.error('Failed to hold current cart. Try clearing it first.');
      return;
    }

    applyToCart(confirmSale);
    setConfirmSale(null);
  }

  function applyToCart(sale: HeldSale) {
    const mapped = sale.lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productNameSnapshot,
      variantDescription: l.variantDescriptionSnapshot,
      sku: l.sku,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      discountPercent: l.discountPercent,
    }));

    replaceCart(mapped, 0, sale.discountAmount);

    queryClient.invalidateQueries({ queryKey: ['held-sales-count'] });
    queryClient.invalidateQueries({ queryKey: ['held-sales'] });
    onOpenChange(false);

    const shortId = sale.id.slice(0, 6).toUpperCase();
    toast.success(`Sale ${shortId} restored to cart`);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-pearl p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-mist/50">
            <SheetTitle className="font-display text-espresso">
              Held Sales
            </SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto h-[calc(100%-60px)] px-4 py-3 space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))
            ) : sales.length === 0 ? (
              <p className="text-center text-mist font-body text-sm py-8">
                No held sales for this shift
              </p>
            ) : (
              sales.map((sale) => {
                const shortId = sale.id.slice(0, 6).toUpperCase();
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => retrieveSale(sale)}
                    className="w-full text-left rounded-lg border border-mist/50 p-3 hover:border-sand hover:bg-sand/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-espresso font-semibold">
                        {shortId}
                      </span>
                      <span className="font-body text-xs text-mist">
                        {relativeTime(sale.createdAt)}
                      </span>
                    </div>
                    <p className="font-body text-xs text-espresso/70 mt-1">
                      {sale.lines.length} item{sale.lines.length !== 1 ? 's' : ''}{' '}
                      &bull; {formatRupee(sale.totalAmount)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmSale !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmSale(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Cart not empty</DialogTitle>
            <DialogDescription className="font-body text-sm text-espresso/60">
              Your current cart will be held automatically before retrieving the
              selected sale.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmSale(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRetrieve}
              disabled={saving}
              className="bg-espresso text-pearl hover:bg-espresso/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Holding…
                </>
              ) : (
                'Hold & Retrieve'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
