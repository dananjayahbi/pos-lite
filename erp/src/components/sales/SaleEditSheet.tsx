'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatRupee } from '@/lib/format';
import { toYMD } from '@/lib/date-range';
import { CustomerPicker, type PickedCustomer } from '@/components/sales/CustomerPicker';
import { saleQueryKey } from '@/components/sales/saleQueryKey';

export interface EditableSale {
  id: string;
  status: string;
  saleDate: string | null;
  createdAt: string;
  deliveryCharge: number | string;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  customer?: { id: string; name: string; phone: string } | null;
}

interface SaleEditSheetProps {
  sale: EditableSale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `yyyy-mm-dd` in local time, from an ISO timestamp. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return toYMD(new Date());
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? toYMD(new Date()) : toYMD(parsed);
}

/**
 * Amend the mutable, financially-inert details of a completed sale.
 *
 * Line items, prices, discounts and tender methods are NOT editable here:
 * changing money that has already been taken goes through a return or a void,
 * both of which restore stock and leave an audit trail. Only the customer
 * link, the accounting date and the delivery charge are amendable.
 */
export function SaleEditSheet({ sale, open, onOpenChange, onSaved }: SaleEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-md">
        <SheetHeader className="shrink-0">
          <SheetTitle className="font-display text-espresso">Edit Sale</SheetTitle>
          <SheetDescription className="text-sand text-xs">
            Customer, date and delivery charge only. Items, prices and payments are
            immutable — use a return or a void for those.
          </SheetDescription>
        </SheetHeader>
        {/* Keyed on the sale id so opening a different row mounts a freshly
            seeded form — no state-syncing effect required. */}
        {sale ? (
          <SaleEditForm
            key={sale.id}
            sale={sale}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : (
          <div className="flex-1" />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SaleEditForm({
  sale,
  onClose,
  onSaved,
}: {
  sale: EditableSale;
  onClose: () => void;
  onSaved?: (() => void) | undefined;
}) {
  const qc = useQueryClient();

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    sale.customer
      ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone }
      : null,
  );
  const [saleDate, setSaleDate] = useState(() =>
    toDateInputValue(sale.saleDate ?? sale.createdAt),
  );
  const [deliveryCharge, setDeliveryCharge] = useState(() => {
    const existing = asNumber(sale.deliveryCharge);
    return existing > 0 ? String(existing) : '';
  });

  const isCompleted = sale.status === 'COMPLETED';

  const previousDelivery = asNumber(sale.deliveryCharge);
  const nextDelivery = Math.max(Number.parseFloat(deliveryCharge) || 0, 0);
  const projectedTotal =
    asNumber(sale.subtotal) -
    asNumber(sale.discountAmount) +
    asNumber(sale.taxAmount) +
    nextDelivery;

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        // `null` is meaningful: it un-links the customer (guest sale).
        customerId: customer ? customer.id : null,
        deliveryCharge: nextDelivery,
      };
      if (saleDate) {
        // Noon local time keeps the calendar day stable across timezones.
        const parsedDate = new Date(`${saleDate}T12:00:00`);
        if (!Number.isNaN(parsedDate.getTime())) {
          body.saleDate = parsedDate.toISOString();
        }
      }

      const res = await fetch(`/api/store/sales/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to update sale');
      }
      return json;
    },
    onSuccess: () => {
      toast.success('Sale updated');
      // Same prefix the history table reads — the row refreshes in place.
      void qc.invalidateQueries({ queryKey: saleQueryKey() });
      onSaved?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update sale');
    },
  });

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {!isCompleted && (
          <p className="text-terracotta border-terracotta/40 bg-terracotta/5 rounded-lg border px-3 py-2 text-xs">
            Only completed sales can be edited. This sale is {sale.status}.
          </p>
        )}

        <CustomerPicker
          value={customer}
          onChange={setCustomer}
          disabled={isPending || !isCompleted}
          guestHint="No customer linked — this sale is recorded as a guest / walk-in."
        />

        <div>
          <Label
            htmlFor="edit-sale-date"
            className="text-espresso mb-1.5 block text-xs font-semibold"
          >
            Selling Date
          </Label>
          <Input
            id="edit-sale-date"
            type="date"
            value={saleDate}
            max={toYMD(new Date())}
            onChange={(event) => setSaleDate(event.target.value)}
            disabled={isPending || !isCompleted}
          />
        </div>

        <div>
          <Label
            htmlFor="edit-delivery-charge"
            className="text-espresso mb-1.5 block text-xs font-semibold"
          >
            Delivery Charge (LKR)
          </Label>
          <Input
            id="edit-delivery-charge"
            type="number"
            min="0"
            step="1"
            value={deliveryCharge}
            onChange={(event) => setDeliveryCharge(event.target.value)}
            placeholder="0"
            disabled={isPending || !isCompleted}
          />
        </div>

        <dl className="divide-mist/40 border-mist divide-y rounded-lg border text-sm">
          <div className="flex justify-between px-3 py-1.5">
            <dt className="text-sand">Current total</dt>
            <dd className="text-espresso font-medium">{formatRupee(asNumber(sale.totalAmount))}</dd>
          </div>
          {nextDelivery !== previousDelivery && (
            <div className="flex justify-between px-3 py-1.5">
              <dt className="text-sand">New total</dt>
              <dd className="text-espresso font-medium">{formatRupee(projectedTotal)}</dd>
            </div>
          )}
        </dl>
      </div>

      <SheetFooter className="shrink-0 gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => save()}
          disabled={isPending || !isCompleted}
          className="bg-espresso text-pearl hover:bg-espresso/90"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </SheetFooter>
    </>
  );
}
