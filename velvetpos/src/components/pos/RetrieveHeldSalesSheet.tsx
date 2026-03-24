'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
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
  const evaluatePromotions = useCartStore((s) => s.evaluatePromotions);
  const setHeldSaleId = useCartStore((s) => s.setHeldSaleId);
  const [confirmSale, setConfirmSale] = useState<HeldSale | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
            quantity: Number(i.quantity),
            discountPercent: Number(i.discountPercent),
            productNameSnapshot: i.productName,
            variantDescriptionSnapshot: i.variantDescription || 'Default',
            sku: i.sku || 'UNKNOWN',
            unitPrice: Number(i.unitPrice),
          })),
          cartDiscountAmount: Number(state.cartDiscountAmount),
          cartDiscountPercent: Number(state.cartDiscountPercent),
          ...(state.heldSaleId ? { saleId: state.heldSaleId } : {}),
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
    // Prisma Decimal fields arrive as strings in JSON; cast to number
    const mapped = sale.lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productNameSnapshot,
      variantDescription: l.variantDescriptionSnapshot || 'Default',
      sku: l.sku || 'UNKNOWN',
      unitPrice: Number(l.unitPrice),
      quantity: Number(l.quantity),
      discountPercent: Number(l.discountPercent),
    }));

    replaceCart(mapped, 0, Number(sale.discountAmount));
    setHeldSaleId(sale.id);

    // Re-evaluate promotions so cart totals reflect any active promotions
    evaluatePromotions();

    queryClient.invalidateQueries({ queryKey: ['held-sales-count'] });
    queryClient.invalidateQueries({ queryKey: ['held-sales'] });
    onOpenChange(false);

    const shortId = sale.id.slice(0, 6).toUpperCase();
    toast.success(`Sale ${shortId} restored to cart`);
  }

  async function deleteSale(saleId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/store/sales/${saleId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? 'Failed to delete held sale');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['held-sales'] });
      queryClient.invalidateQueries({ queryKey: ['held-sales-count'] });
      toast.success('Held sale deleted');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
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
                  <div
                    key={sale.id}
                    className="w-full rounded-lg border border-mist/50 p-3 hover:border-sand transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => retrieveSale(sale)}
                        className="flex-1 text-left hover:opacity-80 transition-opacity"
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

                      {confirmDeleteId === sale.id ? (
                        <div className="flex gap-1 shrink-0 items-center">
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => deleteSale(sale.id)}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white font-body hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleting ? '…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs rounded border border-mist/50 text-espresso font-body hover:bg-sand/20"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(sale.id)}
                          className="shrink-0 p-1 rounded text-mist hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete held sale"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
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
