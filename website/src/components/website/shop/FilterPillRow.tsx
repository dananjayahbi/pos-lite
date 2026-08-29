'use client';

import React from 'react';

export interface FilterPillOption {
  id: string;
  label: string;
}

interface FilterPillRowProps {
  options: FilterPillOption[];
  /** Selected option id (undefined = "All" active). */
  selectedId?: string | undefined;
  /** Called when a pill (or "All") is clicked. */
  onSelect: (optionId: string | undefined) => void;
}

/**
 * Vertical list of filter pills for the shop sidebar. Renders a leading
 * "All" option plus each filter value as a pill; the selected pill is
 * highlighted in green. Selecting a pill updates the client-side filter
 * state via `onSelect` (no navigation / reload).
 */
export function FilterPillRow({ options, selectedId, onSelect }: FilterPillRowProps) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={`category-pill w-fit !px-3 !py-1.5 text-[0.6875rem] text-left ${!selectedId ? 'active' : ''}`}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`category-pill w-fit !px-3 !py-1.5 text-[0.6875rem] text-left ${selectedId === opt.id ? 'active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
