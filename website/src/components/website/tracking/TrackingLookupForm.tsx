'use client';

import React, { useState } from 'react';
import { getPublicTracking } from '@/lib/api/tracking';
import type { PublicTrackingOrder } from '@/types/website.types';
import { TrackingResults } from './TrackingResults';

interface TrackingLookupFormProps {
  tenantSlug: string;
}

/**
 * Order-tracking lookup form. Accepts an order reference or phone number and
 * shows the matching order(s) with their delivery timeline.
 */
export function TrackingLookupForm({ tenantSlug }: TrackingLookupFormProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'ref' | 'phone'>('ref');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PublicTrackingOrder[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError('Enter your order reference or phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    setOrders(null);
    try {
      const res = await getPublicTracking(tenantSlug, {
        [mode]: q,
      });
      setOrders(res.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up your order.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#082017]/70 p-6 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-4">
          {(
            [
              { value: 'ref', label: 'Order reference' },
              { value: 'phone', label: 'Phone number' },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm text-[#cbd5e1]">
              <input
                type="radio"
                name="lookupMode"
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
                className="accent-[#97c93e]"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'ref' ? 'e.g. ORD-2026-0001' : 'e.g. 0712345678'
            }
            className="w-full rounded-lg border border-white/12 bg-[#051610] px-3 py-2 text-sm text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:outline-none sm:flex-1"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#97c93e] px-6 py-2 text-sm font-semibold uppercase tracking-wider text-[#051610] transition-all hover:-translate-y-0.5 hover:bg-[#b2db58] hover:shadow-[0_8px_25px_rgba(151,201,62,0.3)] disabled:opacity-50"
          >
            {loading ? 'Tracking…' : 'Track order'}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </form>

      {orders !== null && (
        <TrackingResults orders={orders} lookupLabel={mode === 'ref' ? 'reference' : 'phone number'} />
      )}
    </div>
  );
}
