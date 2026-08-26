'use client';

export type RepeatBuyersFilter = 'ALL' | 'REPEAT';

interface RepeatBuyersTabsProps {
  value: RepeatBuyersFilter;
  onChange: (value: RepeatBuyersFilter) => void;
  /** Show the matching segment count next to the active label (optional). */
  repeatCount?: number | undefined;
}

/**
 * Segmented control for isolating repeat buyers (doc 20): All / Repeat Buyers.
 * Pure presentational component — the active value and handler come from the parent.
 */
export function RepeatBuyersTabs({ value, onChange, repeatCount }: RepeatBuyersTabsProps) {
  const options: { key: RepeatBuyersFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'REPEAT', label: 'Repeat Buyers' },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-sand/30 bg-white p-1">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-terracotta text-white'
                : 'text-sand hover:text-espresso'
            }`}
          >
            {option.label}
            {active && repeatCount !== undefined && (
              <span
                className={`rounded-full px-1.5 text-xs font-mono ${
                  active ? 'bg-white/20' : 'bg-mist/40'
                }`}
              >
                {repeatCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
