'use client';

import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { ShopFilterPanelProps } from './ShopFilterPanel';
import { ShopFilterPanel } from './ShopFilterPanel';

type MobilePanelProps = Omit<ShopFilterPanelProps, 'isDrawer' | 'onClose'>;

/**
 * Mobile filter drawer. Hidden on md+ screens (where the static sidebar is
 * shown) and presented as a slide-in panel from the left with a backdrop on
 * small screens. The "Filters" button toggles the drawer.
 */
export function ShopFilterDrawer(props: MobilePanelProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Toggle button (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-[#0d2e22]/70 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#cbd5e1] transition-colors hover:border-[#97c93e]/50 hover:text-white"
        aria-expanded={open}
      >
        <SlidersHorizontal size={15} className="text-[#97c93e]" />
        Filters
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[82%] max-w-sm flex-col overflow-y-auto bg-[#082017] border-r border-white/10 p-5 transition-transform duration-300 md:hidden shadow-2xl ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Filters drawer"
        aria-hidden={!open}
      >
        <ShopFilterPanel {...props} isDrawer onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
