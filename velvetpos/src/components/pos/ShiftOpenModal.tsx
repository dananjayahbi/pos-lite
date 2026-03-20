'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ShiftOpenModalProps {
  cashierName: string;
}

export function ShiftOpenModal({ cashierName }: ShiftOpenModalProps) {
  const router = useRouter();
  const [openingFloat, setOpeningFloat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const value = parseFloat(openingFloat);
    if (isNaN(value) || value < 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/store/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat: value }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error?.message ?? `Failed to open shift (${res.status})`,
        );
        return;
      }

      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-espresso">
      <form
        onSubmit={handleSubmit}
        className="bg-pearl rounded-2xl p-8 w-full max-w-md shadow-xl"
      >
        <h1 className="font-display text-espresso text-2xl">VelvetPOS</h1>
        <h2 className="text-lg text-espresso/80 font-display mt-1">
          Open Your Shift
        </h2>

        <p className="text-sm text-espresso/60 font-body mt-4">
          Welcome, {cashierName}. Enter the opening float — the cash currently
          in your till — to begin processing sales.
        </p>

        <div className="mt-6">
          <label
            htmlFor="opening-float"
            className="block text-sm font-body text-espresso mb-1.5"
          >
            Opening Float
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-body text-espresso/60">Rs.</span>
            <input
              id="opening-float"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="flex-1 rounded-lg border border-mist px-3 py-2 text-sm font-body bg-white text-espresso placeholder:text-mist focus:border-sand focus:outline-none focus:ring-1 focus:ring-sand transition-colors"
              placeholder="0.00"
              disabled={loading}
              autoFocus
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-espresso text-pearl py-2.5 text-sm font-body font-medium transition-opacity disabled:opacity-50"
        >
          {loading ? 'Opening…' : 'Start Shift'}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-500 font-body">{error}</p>
        )}
      </form>
    </div>
  );
}
