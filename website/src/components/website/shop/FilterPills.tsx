'use client';

import React from 'react';
import Link from 'next/link';

interface FilterPillOption {
  id: string;
  label: string;
}

interface FilterPillsProps {
  /** Optional row label shown to the left of the pills. */
  label?: string;
  options: FilterPillOption[];
  /** Selected option id (undefined = "All" active). */
  selectedId?: string | undefined;
  /** Build a href for a given option id (undefined = clear filter). */
  buildHref: (optionId: string | undefined) => string;
}

/**
 * Reusable pill filter row for the shop panel (category / concern / form).
 * Selecting a pill navigates to its href; clicking the selected pill (or a
 * leading "All" pill when options are present) clears the filter.
 */
export function FilterPills({
  label,
  options,
  selectedId,
  buildHref,
}: FilterPillsProps) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs text-gray-500">{label}:</span>}
      <Link
        href={buildHref(undefined)}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          !selectedId
            ? 'border-black bg-black text-white'
            : 'border-gray-300 text-gray-600 hover:border-gray-500'
        }`}
      >
        All
      </Link>
      {options.map((opt) => (
        <Link
          key={opt.id}
          href={buildHref(opt.id)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedId === opt.id
              ? 'border-black bg-black text-white'
              : 'border-gray-300 text-gray-600 hover:border-gray-500'
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
