'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterCollapsibleProps {
  title: string;
  /** Show the section collapsed or expanded on first render. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible filter section for the shop sidebar (`#shop-filter-panel`).
 * Toggles open/closed with a smooth chevron rotation; used for the Category,
 * Concern, Form and Price groups.
 */
export function FilterCollapsible({ title, defaultOpen = true, children }: FilterCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/8 pb-5 mb-5 last:border-b-0 last:pb-0 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#97c93e] transition-transform duration-300 ${open ? '' : '-rotate-90'}`}
        />
      </button>

      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
