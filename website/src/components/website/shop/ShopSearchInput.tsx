'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface ShopSearchInputProps {
  tenantSlug: string;
  /** Called with the trimmed query term on submit. */
  onSearch?: (q: string) => void;
}

/**
 * Shop page keyword search input. On submit it bubbles the query up to the
 * parent so it can update the client-side filter state (no navigation).
 */
export function ShopSearchInput({ onSearch }: ShopSearchInputProps) {
  const [term, setTerm] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setTerm('');
    onSearch?.(q);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative" aria-label="Search products">
      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#97c93e]/70" />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search botanical remedy, herb, or benefit..."
        aria-label="Search products"
        className="shop-search-input"
      />
    </form>
  );
}
