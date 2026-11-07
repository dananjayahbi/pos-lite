'use client';

import { useState, useEffect } from 'react';
import { Loader2, QrCode, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PaymentModalProps, CompletedSale } from '@/types/pos.types';
import {
  DEFAULT_LANKA_QR_SETTINGS,
  isRenderableQrImageUrl,
  type LankaQrSettings,
} from '@/lib/payments/lanka-qr-config';

/**
 * LankaQR payment modal.
 *
 * LankaQR is a bank-QR mobile payment. The cashier displays the total to the
 * customer, the customer scans/pays on their banking app, and the cashier
 * confirms the amount. The system does not connect to the QR terminal directly.
 */
export function LankaQRPaymentModal({
  open,
  onClose,
  onSaleComplete,
  totalAmount,
  salePayload,
  settings = DEFAULT_LANKA_QR_SETTINGS,
}: PaymentModalProps & { settings?: LankaQrSettings }) {
  const [qrReferenceNumber, setQrReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasQrImage = isRenderableQrImageUrl(settings.qrImageUrl);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQrReferenceNumber('');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleClose = () => {
    if (
      isSubmitting &&
      !window.confirm('Are you sure? The sale may still be processing.')
    ) {
      return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (settings.referenceRequired && !qrReferenceNumber.trim()) {
      toast.error('Enter the LankaQR transaction reference before confirming');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salePayload,
          paymentMethod: 'LANKAQR',
          cardReferenceNumber: qrReferenceNumber.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: CompletedSale;
        error?: { code: string; message: string };
      };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to complete sale');
        setIsSubmitting(false);
        return;
      }
      onSaleComplete(json.data!);
    } catch {
      toast.error('Network error — please try again');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">LankaQR Payment</DialogTitle>
          <DialogDescription className="font-body text-sm text-mist-ink">
            Customer pays via a LankaQR banking app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total Due */}
          <div>
            <p className="text-xs font-body uppercase tracking-wide text-mist-ink">
              Total Due
            </p>
            <p className="font-mono text-3xl font-bold text-espresso">
              {formatRupee(totalAmount.toNumber())}
            </p>
          </div>

          {/* Static merchant QR */}
          {hasQrImage ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-mist bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.qrImageUrl}
                alt="LankaQR merchant QR code"
                className="h-48 w-48 object-contain"
              />
              {settings.merchantName && (
                <p className="font-body text-sm font-medium text-espresso">
                  {settings.merchantName}
                </p>
              )}
              {(settings.bankName || settings.merchantId) && (
                <p className="text-center font-body text-xs text-mist-ink">
                  {[settings.bankName, settings.merchantId ? `MID ${settings.merchantId}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-mist bg-linen p-4 text-center">
              <QrCode className="h-12 w-12 text-mist-ink" aria-hidden="true" />
              <p className="font-body text-sm text-espresso">
                No static QR image is configured. Ask a manager to add your bank-issued
                LankaQR image in Settings → Payments.
              </p>
            </div>
          )}

          {/* Cashier instructions */}
          <div className="rounded-lg border-l-4 border-[#1D4E89] bg-linen p-3">
            <p className="font-body text-sm text-espresso">{settings.instructions}</p>
          </div>

          {/* QR reference */}
          <div>
            <div className="mb-1 flex items-center gap-1">
              <label className="text-sm font-body text-espresso">
                QR Reference {settings.referenceRequired ? '' : '(optional)'}
              </label>
              <span title="Used for reconciliation with your bank's QR transaction records">
                <Info className="h-3.5 w-3.5 text-mist-ink cursor-help" />
              </span>
            </div>
            <Input
              type="text"
              value={qrReferenceNumber}
              onChange={(e) => setQrReferenceNumber(e.target.value)}
              placeholder="e.g. QR-TX-881200"
              maxLength={20}
              className="font-mono"
              required={settings.referenceRequired}
            />
            {settings.referenceRequired && !qrReferenceNumber.trim() && (
              <p className="mt-1 text-xs font-body text-mist-ink">
                Required — enter the reference shown in the customer&apos;s payment confirmation.
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="h-auto w-full py-3 bg-espresso text-pearl font-body text-base font-bold hover:bg-espresso/90"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <QrCode className="h-5 w-5" />
                Confirm LankaQR Payment — {formatRupee(totalAmount.toNumber())}
              </>
            )}
          </Button>

          {/* Cancel */}
          <button
            type="button"
            onClick={handleClose}
            className="w-full text-center font-body text-sm text-mist-ink hover:text-espresso transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
