'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CartManagerPINModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  onSuccess: (managerId: string) => void;
  required?: boolean | undefined;
}

export function CartManagerPINModal({
  open,
  onOpenChange,
  description,
  onSuccess,
  required = false,
}: CartManagerPINModalProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [failCount, setFailCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const isSubmitting = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setDigits([]);
      setFailCount(0);
      setIsLoading(false);
      setShake(false);
      isSubmitting.current = false;
    }
  }, [open]);

  const handleVerify = useCallback(
    async (pin: string) => {
      if (isSubmitting.current) return;
      isSubmitting.current = true;
      setIsLoading(true);

      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });

        const data = await res.json();

        if (
          res.ok &&
          data.success &&
          (data.data.role === 'MANAGER' || data.data.role === 'OWNER')
        ) {
          onSuccess(data.data.userId);
          onOpenChange(false);
          return;
        }

        // Failure
        const newFailCount = failCount + 1;
        setFailCount(newFailCount);
        setShake(true);
        setTimeout(() => setShake(false), 300);
        setDigits([]);

        if (newFailCount >= 3) {
          if (required) {
            setFailCount(0);
            toast.warning('Invalid PIN. Please try again.');
          } else {
            onOpenChange(false);
            toast.error('Manager authorisation failed — please try again');
          }
        }
      } catch {
        setDigits([]);
      } finally {
        setIsLoading(false);
        isSubmitting.current = false;
      }
    },
    [failCount, onOpenChange, onSuccess],
  );

  const addDigit = useCallback(
    (d: string) => {
      if (isLoading || digits.length >= 4) return;
      const next = [...digits, d];
      setDigits(next);
      if (next.length === 4) {
        void handleVerify(next.join(''));
      }
    },
    [digits, isLoading, handleVerify],
  );

  const removeDigit = useCallback(() => {
    if (isLoading) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [isLoading]);

  const handleSubmit = useCallback(() => {
    if (digits.length === 4 && !isLoading) {
      void handleVerify(digits.join(''));
    }
  }, [digits, isLoading, handleVerify]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'submit', '0', 'backspace'] as const;

  return (
    <Dialog open={open} onOpenChange={required ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display text-[17px] text-espresso">
            {required ? 'Manager Authorization Required' : 'Manager Authorisation Required'}
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-mist">
            {required ? 'Enter a manager PIN to authorize this return.' : description}
          </DialogDescription>
        </DialogHeader>

        {/* PIN dots */}
        <div
          className={`flex justify-center gap-4 py-4 ${shake ? 'animate-pin-shake' : ''}`}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className="text-2xl text-espresso select-none"
              aria-hidden="true"
            >
              {i < digits.length ? '●' : '○'}
            </span>
          ))}
        </div>

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-2">
          {keys.map((key) => {
            if (key === 'submit') {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={handleSubmit}
                  disabled={digits.length !== 4 || isLoading}
                  className="h-16 w-full border border-mist text-espresso font-body text-lg rounded-lg disabled:opacity-40 transition-colors hover:bg-linen"
                >
                  ✓
                </button>
              );
            }
            if (key === 'backspace') {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={removeDigit}
                  disabled={isLoading}
                  className="h-16 w-full border border-mist text-espresso font-body text-lg rounded-lg disabled:opacity-40 transition-colors hover:bg-linen"
                >
                  ⌫
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => addDigit(key)}
                disabled={isLoading}
                className="h-16 w-full border border-mist text-espresso font-body text-lg rounded-lg disabled:opacity-40 transition-colors hover:bg-linen"
              >
                {key}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
