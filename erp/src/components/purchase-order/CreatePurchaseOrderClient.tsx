'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { pinDayToNoonIso, todayIso } from './poDates';
import { PODiscountField } from './PODiscountField';
import { POLinesEditor } from './POLinesEditor';
import { POOrderDateField } from './POOrderDateField';
import { POPaymentAccountField } from './POPaymentAccountField';
import { POPaymentTermsField, type PaymentTermValue } from './POPaymentTermsField';
import { POReferenceField } from './POReferenceField';
import { POSummaryPanel } from './POSummaryPanel';
import { POSupplierField } from './POSupplierField';
import type { PODiscountType, POLineDraft } from './poTypes';
import { useNextPOReference } from './useNextPOReference';

/**
 * The purchase-order create form.
 *
 * One local `draft` object rather than react-hook-form: the shape here is small,
 * the only cross-field rule is "at least one line with a variant", and the
 * summary needs raw strings (a half-typed discount must not collapse to 0). The
 * server re-validates everything with `CreatePOSchema`.
 */

interface PODraft {
  supplierId: string;
  referenceNo: string;
  orderDate: string;
  expectedDeliveryDate: string;
  notes: string;
  discountType: PODiscountType | null;
  discountValue: string;
  paymentTermDays: PaymentTermValue;
  paymentAccountId: string | null;
  lines: POLineDraft[];
}

type FieldErrors = Record<string, string>;

export function CreatePurchaseOrderClient() {
  const router = useRouter();

  const [draft, setDraft] = useState<PODraft>({
    supplierId: '',
    referenceNo: '',
    orderDate: todayIso(),
    expectedDeliveryDate: '',
    notes: '',
    discountType: null,
    discountValue: '',
    paymentTermDays: 30,
    paymentAccountId: null,
    lines: [],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submittingStatus, setSubmittingStatus] = useState<'DRAFT' | 'SENT' | null>(null);

  const suggestedReference = useNextPOReference(draft.orderDate);

  const patch = useCallback((next: Partial<PODraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  }, []);

  const summaryLines = useMemo(
    () =>
      draft.lines.map((line, index) => ({
        label: line.label || `Line ${index + 1}`,
        qty: Number.isFinite(line.orderedQty) ? line.orderedQty : 0,
        unitCost: Number.isFinite(line.expectedCostPrice) ? line.expectedCostPrice : 0,
      })),
    [draft.lines],
  );

  const validate = useCallback((): FieldErrors => {
    const next: FieldErrors = {};

    if (!draft.supplierId) next['supplierId'] = 'Supplier is required';

    if (draft.lines.length === 0) {
      next['lines'] = 'At least one line is required';
    }

    draft.lines.forEach((line, index) => {
      if (!line.variantId) next[`lines.${index}.variantId`] = 'Pick a product for this line';
      if (!Number.isInteger(line.orderedQty) || line.orderedQty < 1) {
        next[`lines.${index}.orderedQty`] = 'Quantity must be at least 1';
      }
      if (!Number.isFinite(line.expectedCostPrice) || line.expectedCostPrice < 0) {
        next[`lines.${index}.expectedCostPrice`] = 'Cost price must be 0 or more';
      }
    });

    const reference = draft.referenceNo.trim();
    if (reference && !/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(reference)) {
      next['referenceNo'] = 'Use letters, digits, /, _ or - only';
    } else if (reference && (reference.length < 3 || reference.length > 40)) {
      next['referenceNo'] = 'Reference must be 3–40 characters';
    }

    if (!draft.orderDate) next['orderDate'] = 'Order date is required';

    if (draft.discountType !== null) {
      const value = Number.parseFloat(draft.discountValue);
      if (!Number.isFinite(value) || value < 0) {
        next['discountValue'] = 'Enter a discount of 0 or more';
      } else if (draft.discountType === 'PERCENTAGE' && value > 100) {
        next['discountValue'] = 'Percentage cannot exceed 100';
      }
    }

    return next;
  }, [draft]);

  const submit = useCallback(
    async (status: 'DRAFT' | 'SENT') => {
      const found = validate();
      setErrors(found);
      if (Object.keys(found).length > 0) {
        toast.error('Please fix the highlighted fields');
        return;
      }

      setSubmittingStatus(status);
      try {
        const orderDateIso = pinDayToNoonIso(draft.orderDate);
        const deliveryIso = pinDayToNoonIso(draft.expectedDeliveryDate);
        const discountValue = Number.parseFloat(draft.discountValue);
        const reference = draft.referenceNo.trim();

        const body: Record<string, unknown> = {
          supplierId: draft.supplierId,
          lines: draft.lines.map((line) => ({
            variantId: line.variantId,
            orderedQty: line.orderedQty,
            expectedCostPrice: line.expectedCostPrice,
          })),
          status,
          paymentTermDays: draft.paymentTermDays,
        };

        if (reference) body['referenceNo'] = reference;
        if (orderDateIso !== undefined) body['orderDate'] = orderDateIso;
        if (deliveryIso !== undefined) body['expectedDeliveryDate'] = deliveryIso;
        if (draft.notes.trim()) body['notes'] = draft.notes.trim();
        if (draft.discountType !== null) {
          body['discountType'] = draft.discountType;
          body['discountValue'] = Number.isFinite(discountValue) ? discountValue : 0;
        }
        if (draft.paymentAccountId) body['paymentAccountId'] = draft.paymentAccountId;

        const response = await fetch('/api/store/purchase-orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await response.json()) as {
          success: boolean;
          data?: { id: string; referenceNo: string };
          error?: { message?: string };
        };

        if (!response.ok || !json.success || !json.data) {
          toast.error(json.error?.message ?? 'Failed to create purchase order');
          return;
        }

        toast.success(
          status === 'DRAFT'
            ? `${json.data.referenceNo} saved as draft`
            : `${json.data.referenceNo} created`,
        );
        router.push(`/suppliers/purchase-orders/${json.data.id}`);
      } catch {
        toast.error('Network error — please try again');
      } finally {
        setSubmittingStatus(null);
      }
    },
    [draft, router, validate],
  );

  const busy = submittingStatus !== null;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-espresso">
          New Purchase Order
        </h1>
        <p className="mt-1 text-sm text-sand">
          Record a supplier order, its terms, and the account it will be settled from.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Order header */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <POSupplierField
                value={draft.supplierId}
                onChange={(supplierId) => patch({ supplierId })}
                error={errors['supplierId']}
                disabled={busy}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <POReferenceField
                  value={draft.referenceNo}
                  onChange={(referenceNo) => patch({ referenceNo })}
                  suggestedReference={suggestedReference}
                  error={errors['referenceNo']}
                  disabled={busy}
                />
                <POOrderDateField
                  value={draft.orderDate}
                  onChange={(orderDate) => patch({ orderDate })}
                  error={errors['orderDate']}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="po-expected-delivery">Expected Delivery Date</Label>
                  <Input
                    id="po-expected-delivery"
                    type="date"
                    value={draft.expectedDeliveryDate}
                    onChange={(event) => patch({ expectedDeliveryDate: event.target.value })}
                    disabled={busy}
                  />
                </div>
                <POPaymentTermsField
                  value={draft.paymentTermDays}
                  onChange={(paymentTermDays) => patch({ paymentTermDays })}
                  orderDate={draft.orderDate}
                  {...(busy ? { disabled: true } : {})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing &amp; Settlement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PODiscountField
                type={draft.discountType}
                value={draft.discountValue}
                onTypeChange={(discountType) => patch({ discountType })}
                onValueChange={(discountValue) => patch({ discountValue })}
                error={errors['discountValue']}
                disabled={busy}
              />
              <POPaymentAccountField
                value={draft.paymentAccountId}
                onChange={(paymentAccountId) => patch({ paymentAccountId })}
                disabled={busy}
              />
              <div className="space-y-1.5">
                <Label htmlFor="po-notes">Notes</Label>
                <Textarea
                  id="po-notes"
                  value={draft.notes}
                  onChange={(event) => patch({ notes: event.target.value })}
                  placeholder="Delivery instructions, supplier remarks…"
                  maxLength={1000}
                  rows={3}
                  disabled={busy}
                />
              </div>
            </CardContent>
          </Card>

          <POLinesEditor
            lines={draft.lines}
            onChange={(lines) => patch({ lines })}
            errors={errors}
            disabled={busy}
          />
        </div>

        {/* Summary + actions */}
        <div>
          <POSummaryPanel
            lines={summaryLines}
            discountType={draft.discountType}
            discountValue={draft.discountValue}
            orderDate={draft.orderDate}
            paymentTermDays={draft.paymentTermDays}
            footer={
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void submit('SENT')}
                >
                  {submittingStatus === 'SENT' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Create Purchase Order
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void submit('DRAFT')}
                >
                  {submittingStatus === 'DRAFT' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={busy}
                  onClick={() => router.push('/suppliers/purchase-orders')}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel PO
                </Button>
                <p className="pt-1 text-center text-xs text-mist">
                  Drafts stay editable; created orders are marked Sent so goods can be received.
                  Cancel PO discards this unsaved order.
                </p>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
