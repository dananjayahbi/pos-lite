'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type RecoveryActionKind = 'FOLLOW_UP_CALL' | 'RESCHEDULED' | 'REDELIVERED' | 'CANCELLED';

interface RecoveryActionDialogProps {
  open: boolean;
  kind: RecoveryActionKind;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    notes?: string | undefined;
    reason?: string | undefined;
    waybillMode?: string;
    manualWaybillId?: string | undefined;
  }) => void;
  isSubmitting: boolean;
  /** Whether to expose manual waybill capture (redelivery only). */
  withWaybill?: boolean;
}

const KIND_TITLE: Record<RecoveryActionKind, string> = {
  FOLLOW_UP_CALL: 'Log Follow-up Call',
  RESCHEDULED: 'Reschedule Delivery',
  REDELIVERED: 'Redeliver Delivery',
  CANCELLED: 'Permanently Cancel Delivery',
};

const KIND_DESCRIPTION: Record<RecoveryActionKind, string> = {
  FOLLOW_UP_CALL: 'Record a follow-up call with the recipient. Use the failure reason above as context.',
  RESCHEDULED: 'Mark this delivery as rescheduled with the courier.',
  REDELIVERED: 'Create a new courier shipment and re-push this failed delivery.',
  CANCELLED: 'Permanently cancel this delivery. Inventory and packaging will be reversed.',
};

export function RecoveryActionDialog({
  open,
  kind,
  onOpenChange,
  onSubmit,
  isSubmitting,
  withWaybill,
}: RecoveryActionDialogProps) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [manualWaybillId, setManualWaybillId] = useState('');

  function reset() {
    setNotes('');
    setReason('');
    setManualWaybillId('');
  }

  function handleSubmit() {
    onSubmit({
      notes: notes.trim() || undefined,
      reason: reason.trim() || undefined,
      waybillMode: manualWaybillId.trim() ? 'MANUAL' : 'AUTO',
      manualWaybillId: manualWaybillId.trim() || undefined,
    });
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{KIND_TITLE[kind]}</DialogTitle>
          <DialogDescription>{KIND_DESCRIPTION[kind]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {withWaybill && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-espresso">
                Manual Waybill Id <span className="font-normal text-espresso/50">(optional)</span>
              </label>
              <Input
                value={manualWaybillId}
                onChange={(e) => setManualWaybillId(e.target.value)}
                placeholder="Leave blank for auto waybill"
              />
            </div>
          )}

          {kind === 'CANCELLED' ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-espresso">Cancel reason</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for permanent cancel"
                rows={2}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-espresso">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for this recovery action"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
