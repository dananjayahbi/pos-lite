'use client';

import React from 'react';
import { Leaf, Truck, ShieldCheck, RotateCcw } from 'lucide-react';

interface ProductTrustBarProps {
  tenantName?: string | undefined;
}

interface TrustItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  sub: string;
}

/**
 * Horizontal trust highlights shown under the product info — reinforces
 * authenticity, delivery, and safety with iconized quick facts.
 */
export function ProductTrustBar({ tenantName }: ProductTrustBarProps) {
  const items: TrustItem[] = [
    { icon: Leaf, label: 'Authentic Ayurveda', sub: `Sourced by ${tenantName ?? 'us'}` },
    { icon: Truck, label: 'Fast Delivery', sub: 'Nationwide shipping' },
    { icon: ShieldCheck, label: 'Quality Assured', sub: 'Lab-tested ingredients' },
    { icon: RotateCcw, label: 'Easy Returns', sub: 'Satisfaction guaranteed' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#082017] p-3 text-center"
        >
          <item.icon size={20} className="text-[#97c93e]" />
          <p className="text-xs font-medium text-white">{item.label}</p>
          <p className="text-[11px] text-[#94a3b8]">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}
