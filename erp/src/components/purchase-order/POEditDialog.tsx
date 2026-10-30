'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { PODiscountField } from './PODiscountField';
import { POOrderDateField } from './POOrderDateField';
import { POPaymentAccountField } from './POPaymentAccountField';
import { POPaymentTermsField, type PaymentTermValue } from './POPaymentTermsField';
import { POReferenceField } from './POReferenceField';
import { updatePurchaseOrder } from './poApi';
import { pinDayToNoonIso } from './poDates';
import { poQueryKeys } from './poQueryKeys';
import type { PODiscountType, PurchaseOrderDetail } from './poTypes';

/**
 * Amend an existing purchase order.
 *
 * Scope is deliberate: the reference, dates, terms, discount and payment
 * account are editable at ANY status because a manager routinely needs to
 * correct them after the goods arrive. Line items are only offered while
 * nothing has been received — receiving has already moved stock and written
 * batch records, so the line set is frozen from then on (enforced server-side
 * too). Prices and quantities of already-received goods go through stock
 * adjustment or a new PO, never a silent edit.
 */
interface POEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: Pick<
    PurchaseOrderDetail,
    | 'id'
    | 'referenceNo'
    | 'orderDate'
    | 'expectedDeliveryDate'
    | 'discountType'
    | 'discountValue'
    | 'paymentTermDays'
    | 'paymentAccountId'
    | 'linesEditable'
  >;
}

/** Local `yyyy-mm-dd` from an ISO timestamp (the day the operator originally chose). */
function toDayInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function toTermValue(days: number | null): PaymentTermValue {
  if (days === 30 || days === 10) return days;
  return null;
}

export function POEditDialog({ open, onOpenChange, purchaseOrder }: POEditDialogProps) {
  const queryClient = useQueryClient();

  const [referenceNo, setReferenceNo] = useState(purchaseOrder.referenceNo);
  const [orderDate, setOrderDate] = useState(toDayInput(purchaseOrder.orderDate));
  const [expectedDelivery, setExpectedDelivery] = useState(
    toDayInput(purchaseOrder.expectedDeliveryDate),
  );
  const [termDays, setTermDays] = useState<PaymentTermValue>(
    toTermValue(purchaseOrder.paymentTermDays),
  );
  const [discountType, setDiscountType] = useState<PODiscountType | null>(
    purchaseOrder.discountType,
  );
  const [discountValue, setDiscountValue] = useState(
    Number(purchaseOrder.discountValue) > 0 ? String(purchaseOrder.discountValue) : '',
  );
  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(
    purchaseOrder.paymentAccountId,
  );

  const mutation = useMutation({
    mutationFn: () => {
      const parsedDiscount = Number.parseFloat(discountValue);

      return updatePurchaseOrder(purchaseOrder.id, {
        referenceNo: referenceNo.trim(),
        ...(orderDate ? { orderDate: pinDayToNoonIso(orderDate) } : {}),
        expectedDeliveryDate: expectedDelivery
          ? (pinDayToNoonIso(expectedDelivery) ?? null)
          : null,
        discountType,
        discountValue: Number.isFinite(parsedDiscount) && parsedDiscount > 0 ? parsedDiscount : 0,
        paymentTermDays: termDays,
        paymentAccountId,
      });
    },
    onSuccess: () => {
      // The detail query is keyed under the SINGULAR root (`['purchase-order', id]`,
      // shared with the receiving page), while `all` is the plural list root.
      // Invalidating only `all` left the detail page showing stale values after a
      // save, so both roots are invalidated here.
      void queryClient.invalidateQueries({ queryKey: poQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: poQueryKeys.details() });
      onOpenChange(false);
    },
  });

  const referenceError =
    referenceNo.trim().length < 3 ? 'Reference must be at least 3 characters' : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Purchase Order</DialogTitle>
          <DialogDescription>
            Correct the reference, dates, terms, discount or payment account.
            {purchaseOrder.linesEditable === false
              ? ' Lines are locked because goods have already been received.'
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <POReferenceField
            value={referenceNo}
            onChange={setReferenceNo}
            {...(referenceError ? { error: referenceError } : {})}
          />

          <POOrderDateField value={orderDate} onChange={setOrderDate} />

          <div>
            <Label htmlFor="po-edit-expected" className="mb-1.5 block text-xs font-semibold">
              Expected delivery date
            </Label>
            <input
              id="po-edit-expected"
              type="date"
              value={expectedDelivery}
              onChange={(event) => setExpectedDelivery(event.target.value)}
              className="border-mist bg-pearl text-espresso focus-visible:ring-espresso/30 h-9 w-full rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          <POPaymentTermsField value={termDays} onChange={setTermDays} orderDate={orderDate} />

          <PODiscountField
            type={discountType}
            value={discountValue}
            onTypeChange={setDiscountType}
            onValueChange={setDiscountValue}
          />

          <POPaymentAccountField value={paymentAccountId} onChange={setPaymentAccountId} />

          {mutation.isError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {mutation.error instanceof Error ? mutation.error.message : 'Could not save changes'}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || Boolean(referenceError)}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
