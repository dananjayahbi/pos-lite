'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PinEntryModalProps {
  onSuccess: () => void;
  onCancel?: () => void;
  userDisplayName: string;
  userEmail: string;
  isOverlay?: boolean;
}

export default function PinEntryModal({
  onSuccess,
  onCancel,
  userDisplayName,
  userEmail,
  isOverlay = false,
}: PinEntryModalProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pin = useMemo(() => digits.join(''), [digits]);

  const appendDigit = (digit: string) => {
    setError(null);
    setDigits((current) => {
      if (current.length >= 4) {
        return current;
      }
      return [...current, digit];
    });
  };

  const removeLastDigit = () => {
    setError(null);
    setDigits((current) => current.slice(0, -1));
  };

  const clearDigits = () => {
    setDigits([]);
  };

  const handleSubmit = async () => {
    if (pin.length !== 4 || !userEmail) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const pinResponse = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          pin,
        }),
      });

      if (!pinResponse.ok) {
        setError('Incorrect PIN');
        clearDigits();
        return;
      }

      const signInResult = await signIn('pin', {
        email: userEmail,
        pin,
        redirect: false,
      });

      if (signInResult?.error) {
        setError('Incorrect PIN');
        clearDigits();
        return;
      }

      clearDigits();
      onSuccess();
    } catch {
      setError('Incorrect PIN');
      clearDigits();
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <Card className="w-full max-w-sm border-mist bg-linen p-6 shadow-lg">
      <div className="mb-4 text-center">
        <h3 className="font-display text-2xl text-espresso">Enter PIN</h3>
        <p className="text-sm text-text-muted">{userDisplayName}</p>
      </div>

      <div className="mb-5 flex justify-center gap-3">
        {Array.from({ length: 4 }).map((_, index) => {
          const filled = index < digits.length;
          return (
            <span
              key={`pin-dot-${index + 1}`}
              className={`h-4 w-4 rounded-full border border-mist ${
                filled ? 'bg-espresso' : 'bg-linen'
              }`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <Button
            key={digit}
            type="button"
            className="h-16 bg-espresso text-pearl hover:bg-terracotta"
            onClick={() => appendDigit(digit)}
            disabled={submitting || digits.length >= 4}
          >
            {digit}
          </Button>
        ))}

        <Button
          type="button"
          variant="outline"
          className="h-16 border-mist bg-mist text-espresso hover:bg-sand"
          onClick={removeLastDigit}
          disabled={submitting || digits.length === 0}
        >
          ⌫
        </Button>

        <Button
          type="button"
          className="h-16 bg-espresso text-pearl hover:bg-terracotta"
          onClick={() => appendDigit('0')}
          disabled={submitting || digits.length >= 4}
        >
          0
        </Button>

        <Button
          type="button"
          className="h-16 bg-success text-pearl hover:bg-success/90 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || digits.length !== 4}
        >
          {submitting ? '...' : 'OK'}
        </Button>
      </div>

      {error ? <p className="mt-4 text-center text-sm text-danger">{error}</p> : null}

      {!isOverlay ? (
        <div className="mt-4 text-center text-sm">
          <Link className="text-terracotta hover:underline" href="/login">
            Sign in with password instead
          </Link>
        </div>
      ) : null}

      {onCancel ? (
        <div className="mt-3 text-center">
          <button
            className="text-sm text-text-muted hover:text-terracotta"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </Card>
  );

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-espresso/90 p-4">
        {modalContent}
      </div>
    );
  }

  return <div className="w-full">{modalContent}</div>;
}
