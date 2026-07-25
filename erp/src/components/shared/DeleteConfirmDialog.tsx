'use client';

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

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  confirmLabel?: string;
  /** Optional detail line below description (e.g. product count) */
  detail?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  onConfirm,
  confirmLabel = 'Delete',
  detail,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">{title}</DialogTitle>
          <DialogDescription className="font-body text-mist">
            {description}
          </DialogDescription>
          {detail ? (
            <p className="mt-1 text-xs text-mist/80">{detail}</p>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-sand text-espresso"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
