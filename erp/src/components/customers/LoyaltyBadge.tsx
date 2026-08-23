'use client';

import { Star, Repeat, Sparkles } from 'lucide-react';
import { getLoyaltyTier, LOYALTY_TIER_META } from '@/lib/services/customer-loyalty';

interface LoyaltyBadgeProps {
  /** The customer's order count — the only input; all rendering derives from it. */
  orderCount: number;
  /** 'sm' for tight spaces (search dropdown), 'md' for list rows. */
  size?: 'sm' | 'md';
  /** Show a title/tooltip explaining the tier rule (default true). */
  showTooltip?: boolean;
}

const SIZE_CLASSES = {
  sm: {
    icon: 'h-3 w-3',
    text: 'text-[10px]',
    badge: 'gap-0.5 px-1.5 py-px',
  },
  md: {
    icon: 'h-3.5 w-3.5',
    text: 'text-[11px]',
    badge: 'gap-1 px-2 py-0.5',
  },
} as const;

const TIER_STYLES = {
  FIRST_TIME: {
    icon: Sparkles,
    className: 'bg-mist/30 text-sand',
  },
  REPEAT: {
    icon: Repeat,
    className: 'bg-amber-100 text-amber-800',
  },
  LOYAL: {
    icon: Star,
    className: 'bg-yellow-100 text-yellow-700',
  },
} as const;

/**
 * Presentational loyalty badge. No business logic — derives the tier from the
 * order count passed in and renders an inline indicator (⭐ loyal, 🔁 repeat).
 */
export function LoyaltyBadge({ orderCount, size = 'md', showTooltip = true }: LoyaltyBadgeProps) {
  const tier = getLoyaltyTier(orderCount);
  const meta = LOYALTY_TIER_META[tier];
  const styles = TIER_STYLES[tier];
  const sizeClasses = SIZE_CLASSES[size];
  const Icon = styles.icon;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${styles.className} ${sizeClasses.badge}`}
      title={showTooltip ? `${meta.label} · ${meta.hint}` : undefined}
      aria-label={meta.label}
    >
      <Icon className={sizeClasses.icon} aria-hidden />
      <span className={sizeClasses.text}>{meta.label}</span>
    </span>
  );
}
