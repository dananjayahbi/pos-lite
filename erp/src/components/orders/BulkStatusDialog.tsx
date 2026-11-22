'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeliveryStatus } from '@/generated/prisma/client';

interface BulkStatusDialogProps {
  count: number;
  /**
   * Statuses legal for every selected order (ARGUS #263). Empty means the
   * selection has no shared move — the dialog refuses to guess.
   */
  allowedStatuses: readonly DeliveryStatus[];
  onCancel: () => void;
  onConfirm: (status: DeliveryStatus) => void;
  isPending?: boolean;
}

export function BulkStatusDialog({
  count,
  allowedStatuses,
  onCancel,
  onConfirm,
  isPending = false,
}: BulkStatusDialogProps) {
  const [status, setStatus] = useState<DeliveryStatus | null>(
    allowedStatuses[0] ?? null,
  );
  const noSharedStatus = allowedStatuses.length === 0;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">Change status</DialogTitle>
          <DialogDescription>
            {noSharedStatus
              ? `No common status is valid for the ${count} selected order(s). Failed and returned parcels are handled in Failed Deliveries & Recovery.`
              : `Change the status of ${count} selected order(s). Only statuses valid for every selected order are listed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-espresso">New status</label>
          <Select
            {...(status ? { value: status } : {})}
            onValueChange={(v) => setStatus(v as DeliveryStatus)}
            disabled={noSharedStatus}
          >
            <SelectTrigger>
              <SelectValue placeholder={noSharedStatus ? 'No valid status' : 'Select status'} />
            </SelectTrigger>
            <SelectContent>
              {allowedStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, ' ').toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (status) onConfirm(status);
            }}
            disabled={isPending || !status}
            aria-busy={isPending}
            data-testid="bulk-status-apply"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
            ) : null}
            {isPending ? 'Applying…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
