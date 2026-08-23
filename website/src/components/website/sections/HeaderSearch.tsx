'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { buildShopUrl } from '@/lib/api/shopQuery';

interface HeaderSearchProps {
  tenantSlug: string;
}

/**
 * Sitewide keyword search input. Submitting routes to the shop page with the
 * query term set in the shared shop query-state (`/shop?q=...`).
 */
export function HeaderSearch({ tenantSlug }: HeaderSearchProps) {
  const router = useRouter();
  const [term, setTerm] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setTerm('');
    router.push(buildShopUrl(tenantSlug, { q }));
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="header-search"
      aria-label="Search products"
    >
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="header-search-input"
      />
      <button type="submit" aria-label="Search" className="header-search-btn">
        <Search size={16} />
      </button>

      <style jsx>{`
        .header-search {
          display: flex;
          align-items: center;
          border: 1px solid #ddd;
          border-radius: 999px;
          overflow: hidden;
          background: #fff;
          padding-left: 12px;
        }
        .header-search-input {
          border: none;
          outline: none;
          font-size: 0.8125rem;
          padding: 7px 4px;
          min-width: 0;
          width: 140px;
          color: #333;
        }
        .header-search-input::placeholder {
          color: #aaa;
        }
        .header-search-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          cursor: pointer;
          padding: 8px 10px;
          color: #666;
        }
        .header-search-btn:hover {
          color: var(--site-accent, #b08d6d);
        }
        @media (max-width: 640px) {
          .header-search-input {
            width: 100px;
          }
        }
      `}</style>
    </form>
  );
}
