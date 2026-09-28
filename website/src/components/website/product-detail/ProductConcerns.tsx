'use client';

import React from 'react';

interface ProductConcernsProps {
  /** Curated wellness concerns / health tags for the product. */
  concerns: string[];
}

/**
 * Small pill chips for the curated wellness concerns (e.g. joints, massage,
 * pain-relief). Renders nothing when there are no concerns, so callers can
 * always include it.
 */
export function ProductConcerns({ concerns }: ProductConcernsProps) {
  const items = (concerns ?? []).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((concern) => (
        <span
          key={concern}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#97c93e]/30 bg-[#97c93e]/10 px-3 py-1 text-xs font-medium text-[#d2f0a0]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#97c93e]" />
          {concern}
        </span>
      ))}
    </div>
  );
}
