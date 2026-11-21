'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCancelDelivery } from '@/hooks/delivery';
import { cancellableStatusesLabel } from './cancelDelivery';

interface CancelDeliveryDialogProps {
  delivery: { id: string; orderRef: string } | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Shared confirmation for the delivery list and detail (ARGUS #272). The
 * detail previously cancelled on a single click; both surfaces now collect a
 * reason and only submit from this dialog.
 */
export function CancelDeliveryDialog({
  delivery,
  open,
  onClose,
}: CancelDeliveryDialogProps) {
  const cancelDelivery = useCancelDelivery();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open && delivery !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Cancel delivery</DialogTitle>
          <DialogDescription>
            Cancel {delivery?.orderRef}? Reserved stock will be returned to inventory. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="text-sm font-medium text-espresso">
            Reason (optional)
          </label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this delivery being cancelled?"
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-espresso/40">
            Only {cancellableStatusesLabel()} deliveries can be cancelled.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cancelDelivery.isPending}>
            Keep delivery
          </Button>
          <Button
            variant="destructive"
            disabled={cancelDelivery.isPending || !delivery}
            aria-busy={cancelDelivery.isPending}
            onClick={() => {
              if (!delivery) return;
              cancelDelivery.mutate(
                { id: delivery.id, ...(reason.trim() ? { reason: reason.trim() } : {}) },
                { onSuccess: onClose },
              );
            }}
          >
            {cancelDelivery.isPending ? 'Cancelling...' : 'Cancel delivery'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
