'use client';

import React, { useEffect, useState } from 'react';
import { formatLKR } from '@/lib/utils';

interface PriceRangeFilterProps {
  /** Observed catalog price bounds used to seed the controls. */
  bounds: { min: number; max: number };
  /** Currently applied min/max (undefined = not filtering). */
  valueMin?: number | undefined;
  valueMax?: number | undefined;
  /** Navigate with the chosen price range (undefined = clear price filter). */
  onApply: (min?: number, max?: number) => void;
}

/**
 * Dual-range price filter (min & max) for the shop sidebar.
 *
 * Two range thumbs update the visible labels instantly while the user drags,
 * but nothing is applied until the user clicks the explicit **Apply** button.
 * A separate **Clear** button resets to the full catalog range. This is a
 * deterministic, predictable control — the user explicitly commits a price
 * range rather than auto-applying on every drag tick (which can feel laggy or
 * silently miss the intended range).
 */
export function PriceRangeFilter({ bounds, valueMin, valueMax, onApply }: PriceRangeFilterProps) {
  const low = bounds.min;
  const high = bounds.max || 100000;
  const step = Math.max(1, Math.round((high - low) / 50));

  const [localMin, setLocalMin] = useState<number>(valueMin ?? low);
  const [localMax, setLocalMax] = useState<number>(valueMax ?? high);

  // Re-sync the local values only when the applied range changes externally
  // (e.g. browser back/forward, or a pill clears the price filter).
  useEffect(() => {
    setLocalMin(valueMin ?? low);
    setLocalMax(valueMax ?? high);
  }, [valueMin, valueMax, low, high]);

  function handleMinChange(value: number) {
    setLocalMin(Math.min(value, localMax));
  }

  function handleMaxChange(value: number) {
    setLocalMax(Math.max(value, localMin));
  }

  const isFiltering = localMin > low || localMax < high;

  function apply() {
    onApply(localMin > low ? localMin : undefined, localMax < high ? localMax : undefined);
  }

  function clear() {
    setLocalMin(low);
    setLocalMax(high);
    onApply(undefined, undefined);
  }

  return (
    <div className="space-y-4">
      {/* Live value labels */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-sans">
        <span className="text-[#97c93e] font-semibold">{formatLKR(localMin)}</span>
        <span className="text-[#64748b]">—</span>
        <span className="text-[#97c93e] font-semibold">{formatLKR(localMax)}</span>
      </div>

      {/* Min slider */}
      <div className="flex flex-col w-full">
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-[#94a3b8] mb-1.5">Min</span>
        <input
          type="range"
          min={low}
          max={high}
          step={step}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          aria-label="Minimum price"
          className="shop-price-slider"
        />
      </div>

      {/* Max slider */}
      <div className="flex flex-col w-full">
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-[#94a3b8] mb-1.5">Max</span>
        <input
          type="range"
          min={low}
          max={high}
          step={step}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          aria-label="Maximum price"
          className="shop-price-slider"
        />
      </div>

      {/* Actions */}
      <div className={`grid gap-2 pt-1 ${isFiltering ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          onClick={apply}
          className="rounded-lg border border-[#97c93e]/40 bg-[#97c93e]/10 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#97c93e] transition-colors hover:bg-[#97c93e] hover:text-[#051610]"
        >
          Apply
        </button>
        {isFiltering && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-white/15 py-2 text-[11px] font-medium uppercase tracking-wider text-[#cbd5e1] transition-colors hover:border-white/30 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
