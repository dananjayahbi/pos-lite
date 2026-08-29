'use client';

import React, { useEffect, useState } from 'react';

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
 * Paired min/max price inputs for the shop filter panel. Seeded from the
 * observed catalog bounds; an explicit "Apply" navigates with the values and a
 * "Clear" resets the price filter.
 */
export function PriceRangeFilter({
  bounds,
  valueMin,
  valueMax,
  onApply,
}: PriceRangeFilterProps) {
  const [min, setMin] = useState<string>(valueMin !== undefined ? String(valueMin) : '');
  const [max, setMax] = useState<string>(valueMax !== undefined ? String(valueMax) : '');

  // Keep the inputs in sync when the applied range changes via other controls.
  useEffect(() => {
    setMin(valueMin !== undefined ? String(valueMin) : '');
    setMax(valueMax !== undefined ? String(valueMax) : '');
  }, [valueMin, valueMax]);

  function parse(raw: string): number | undefined {
    const n = Number(raw);
    return raw.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#94a3b8]">Price:</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          placeholder={String(bounds.min)}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          aria-label="Minimum price"
          className="w-20 rounded-lg border border-white/12 bg-[#051610] px-2 py-1.5 text-xs text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:ring-1 focus:ring-[#97c93e] outline-none"
        />
        <span className="text-xs text-[#64748b]">–</span>
        <input
          type="number"
          min={0}
          placeholder={String(bounds.max)}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          aria-label="Maximum price"
          className="w-20 rounded-lg border border-white/12 bg-[#051610] px-2 py-1.5 text-xs text-white placeholder:text-[#64748b] focus:border-[#97c93e] focus:ring-1 focus:ring-[#97c93e] outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => onApply(parse(min), parse(max))}
        className="rounded-lg border border-white/15 px-2 py-1.5 text-xs font-medium text-[#cbd5e1] hover:border-[#97c93e]/50 hover:text-white"
      >
        Apply
      </button>
      {(valueMin !== undefined || valueMax !== undefined) && (
        <button
          type="button"
          onClick={() => {
            setMin('');
            setMax('');
            onApply(undefined, undefined);
          }}
          className="rounded px-2 py-1.5 text-xs font-medium text-[#94a3b8] underline hover:text-[#97c93e]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
