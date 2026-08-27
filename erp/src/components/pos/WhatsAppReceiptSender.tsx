'use client';

import { useState, useCallback } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface WhatsAppReceiptSenderProps {
  saleId: string;
  className?: string;
}

type Status = 'idle' | 'loading' | 'sent' | 'error';

/**
 * Inline control for sending a sale receipt over WhatsApp from the sale detail
 * modal. Mirrors the flow in `ReceiptPreviewDialog` but is standalone so it can
 * be reused wherever a completed sale is shown.
 */
export function WhatsAppReceiptSender({
  saleId,
  className,
}: WhatsAppReceiptSenderProps) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const handleSend = useCallback(async () => {
    if (!phone.trim()) return;
    setStatus('loading');
    setError('');

    try {
      const res = await fetch(`/api/store/sales/${saleId}/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        setStatus('sent');
        toast.success('Receipt sent via WhatsApp');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setError(json.error?.message ?? 'Failed to send WhatsApp receipt');
      }
    } catch {
      setStatus('error');
      setError('Network error — please try again');
    }
  }, [saleId, phone]);

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="Phone e.g. 077 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 font-mono"
          disabled={status === 'loading' || status === 'sent'}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!phone.trim() || status === 'loading' || status === 'sent'}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-terracotta px-3 py-1.5 text-sm font-body text-terracotta transition-colors hover:bg-terracotta/10 disabled:opacity-50"
        >
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'sent' ? 'Sent ✓' : (
            <>
              <Send className="h-4 w-4" />
              Send
            </>
          )}
        </button>
      </div>
      {status === 'error' && (
        <div className="flex items-center justify-between rounded-md bg-[#9B2226]/10 px-3 py-2 text-xs font-body text-[#9B2226]">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleSend}
            className="ml-2 shrink-0 text-xs font-bold underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
