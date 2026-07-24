'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

interface ResetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

/**
 * A confirmation dialog that requires the user to type "confirm"
 * before the reset action can be executed. Prevents accidental data loss.
 */
export function ResetConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  disabled = false,
}: ResetConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');

  const isValid = typedValue.toLowerCase() === 'confirm';

  const handleConfirm = useCallback(() => {
    if (!isValid) return;
    onConfirm();
    setTypedValue('');
    onOpenChange(false);
  }, [isValid, onConfirm, onOpenChange]);

  const handleClose = useCallback(() => {
    setTypedValue('');
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!disabled}
        className="sm:max-w-md"
        onInteractOutside={(e) => disabled && e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-espresso">Reset Configuration</DialogTitle>
              <DialogDescription className="text-sand mt-1">
                This will discard all unsaved changes and restore the last saved
                configuration. This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <p className="text-sm text-sand">
            Type <span className="font-semibold text-espresso">confirm</span> to proceed:
          </p>
          <Input
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder="Type 'confirm' here"
            className="h-10"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid) {
                handleConfirm();
              }
            }}
          />
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} disabled={disabled}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || disabled}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Reset Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
