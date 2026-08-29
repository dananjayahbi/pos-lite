'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface ResultsStatusBarProps {
  count: number;
  query?: string | undefined;
}

/**
 * Results count status strip above the product mesh (reference: the
 * `#results-count` row). Shows the live product count plus the
 * "100% Organically Wild-Harvested" assurance tag.
 */
export function ResultsStatusBar({ count, query }: ResultsStatusBarProps) {
  const revealRef = useRevealOnScroll<HTMLDivElement>();
  const label = query ? `${count} results for "${query}"` : 'Loading botanical remedies...';
  const display = count > 0 ? `${count} botanical ${count === 1 ? 'remedy' : 'remedies'} available` : label;

  return (
    <div ref={revealRef} className="shop-results-status">
      <span>{query ? `Results for "${query}"` : display}</span>
      <span className="text-[#97c93e]/80">100% Organically Wild-Harvested</span>
    </div>
  );
}
