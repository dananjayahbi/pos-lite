'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, Loader2, Printer, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { formatRupee } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CompletedSale } from '@/types/pos.types';

interface ReceiptPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onNewSale: () => void;
  completedSale: CompletedSale | null;
  changeAmount: Decimal | null;
}

type WhatsAppStatus = 'idle' | 'loading' | 'sent' | 'error';

export function ReceiptPreviewDialog({
  open,
  onClose,
  onNewSale,
  completedSale,
  changeAmount,
}: ReceiptPreviewDialogProps) {
  const [phone, setPhone] = useState('');
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>('idle');
  const [waError, setWaError] = useState('');
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset whatsapp state when dialog closes
  useEffect(() => {
    if (!open) {
      setPhone('');
      setWaStatus('idle');
      setWaError('');
      if (sentTimerRef.current !== undefined) {
        clearTimeout(sentTimerRef.current);
        sentTimerRef.current = undefined;
      }
    }
  }, [open]);

  const handleSendWhatsApp = useCallback(async () => {
    if (!completedSale || !phone.trim()) return;

    setWaStatus('loading');
    setWaError('');

    try {
      const res = await fetch(`/api/store/sales/${completedSale.id}/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });

      const json = await res.json();

      if (json.success) {
        setWaStatus('sent');
        sentTimerRef.current = setTimeout(() => {
          setWaStatus('idle');
          sentTimerRef.current = undefined;
        }, 3000);
      } else {
        setWaStatus('error');
        setWaError(json.error?.message ?? 'Failed to send WhatsApp receipt');
      }
    } catch {
      setWaStatus('error');
      setWaError('Network error — please try again');
    }
  }, [completedSale, phone]);

  const handlePrint = useCallback(() => {
    if (!completedSale) return;
    window.open(`/api/store/sales/${completedSale.id}/receipt`, '_blank', 'noopener');
  }, [completedSale]);

  if (!completedSale) return null;

  const showChange =
    changeAmount !== null &&
    (completedSale.paymentMethod === 'CASH' || completedSale.paymentMethod === 'SPLIT');

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        // Suppress escape / backdrop close
        if (!isOpen) return;
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Sale Complete</DialogTitle>
        </DialogHeader>

        {/* Success header */}
        <div className="flex flex-col items-center gap-2 pt-2 pb-4">
          <CheckCircle2 className="h-12 w-12" style={{ color: '#2D6A4F' }} />
          <h2 className="font-display text-2xl text-espresso">Sale Complete!</h2>
        </div>

        {/* Summary block */}
        <div className="bg-linen rounded-lg border-2 border-sand p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Sale Ref</span>
            <span className="font-mono text-sm text-espresso">
              {completedSale.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Total</span>
            <span className="font-mono text-xl font-bold text-espresso">
              {formatRupee(completedSale.totalAmount)}
            </span>
          </div>
          {showChange && (
            <div className="flex justify-between items-center">
              <span className="font-body text-sm text-mist">Change Due</span>
              <span
                className={`font-mono text-xl font-bold ${
                  changeAmount.isZero() ? 'text-espresso' : 'text-[#2D6A4F]'
                }`}
              >
                {formatRupee(changeAmount.toNumber())}
              </span>
            </div>
          )}
        </div>

        {/* WhatsApp section */}
        <div className="space-y-2 pt-2">
          <span className="font-body text-sm text-mist">Send Receipt via WhatsApp</span>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="e.g. 077 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 font-mono"
              disabled={waStatus === 'loading' || waStatus === 'sent'}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-terracotta border-terracotta hover:bg-terracotta/10 shrink-0"
              onClick={handleSendWhatsApp}
              disabled={!phone.trim() || waStatus === 'loading' || waStatus === 'sent'}
            >
              {waStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
              {waStatus === 'sent' && 'Sent ✓'}
              {waStatus === 'idle' && <><Send className="h-4 w-4 mr-1" /> Send</>}
              {waStatus === 'error' && <><Send className="h-4 w-4 mr-1" /> Send</>}
            </Button>
          </div>
          {waStatus === 'error' && (
            <div className="bg-[#9B2226]/10 text-[#9B2226] rounded-md px-3 py-2 text-xs font-body flex items-center justify-between">
              <span>{waError}</span>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="underline text-xs font-bold ml-2 shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Print Receipt */}
        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Receipt
        </Button>

        {/* No receipt link */}
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center font-body text-sm text-mist hover:text-espresso transition-colors py-1"
        >
          No Receipt — close
        </button>

        {/* New Sale button */}
        <Button
          className="w-full bg-espresso text-pearl hover:bg-espresso/90"
          onClick={onNewSale}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Sale
        </Button>
      </DialogContent>
    </Dialog>
  );
}
