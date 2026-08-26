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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DELIVERY_STATUSES } from '@/lib/validators/delivery.validators';
import type { DeliveryStatus } from '@/generated/prisma/client';

interface BulkStatusDialogProps {
  count: number;
  onCancel: () => void;
  onConfirm: (status: DeliveryStatus) => void;
}

export function BulkStatusDialog({ count, onCancel, onConfirm }: BulkStatusDialogProps) {
  const [status, setStatus] = useState<DeliveryStatus>('PENDING_DISPATCH');

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">Change status</DialogTitle>
          <DialogDescription>
            Change the status of {count} selected order(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-espresso">New status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, ' ').toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(status)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
