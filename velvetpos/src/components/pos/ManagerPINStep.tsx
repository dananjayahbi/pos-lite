'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

interface ManagerPINStepProps {
  onAuthorized: (managerId: string) => void;
}

export function ManagerPINStep({ onAuthorized }: ManagerPINStepProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = useRef<boolean>(undefined);

  const handleVerify = useCallback(
    async (pin: string) => {
      if (isSubmitting.current) return;
      isSubmitting.current = true;
      setIsLoading(true);
      setErrorMessage(null);

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
          onAuthorized(data.data.userId);
          return;
        }

        setShake(true);
        setTimeout(() => setShake(false), 300);
        setDigits([]);
        setErrorMessage('Invalid PIN or insufficient permissions');
      } catch {
        setDigits([]);
        toast.error('Network error. Please try again.');
      } finally {
        setIsLoading(false);
        isSubmitting.current = false;
      }
    },
    [onAuthorized],
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
    setErrorMessage(null);
  }, [isLoading]);

  const handleSubmit = useCallback(() => {
    if (digits.length === 4 && !isLoading) {
      void handleVerify(digits.join(''));
    }
  }, [digits, isLoading, handleVerify]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'submit', '0', 'backspace'] as const;

  return (
    <div className="flex flex-col items-center py-4 space-y-4">
      <p className="font-body text-sm text-espresso text-center">
        Manager authorization is required to process this return.
      </p>
      <p className="font-body text-xs text-mist text-center">
        Enter a manager PIN to authorize.
      </p>

      {/* PIN dots */}
      <div
        className={`flex justify-center gap-4 py-3 ${shake ? 'animate-pin-shake' : ''}`}
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

      {errorMessage && (
        <p className="font-body text-xs text-[#9B2226] text-center">{errorMessage}</p>
      )}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-70">
        {keys.map((key) => {
          if (key === 'submit') {
            return (
              <button
                key={key}
                type="button"
                onClick={handleSubmit}
                disabled={digits.length !== 4 || isLoading}
                className="h-14 w-full border border-mist text-espresso font-body text-lg rounded-lg disabled:opacity-40 transition-colors hover:bg-linen"
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
                className="h-14 w-full border border-mist text-espresso font-body text-lg rounded-lg disabled:opacity-40 transition-colors hover:bg-linen"
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
              className="h-14 w-full border border-mist text-espresso font-body text-lg rounded-lg disabled:opacity-40 transition-colors hover:bg-linen"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
