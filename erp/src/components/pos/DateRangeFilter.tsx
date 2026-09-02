'use client';

import {
  computePresetRange,
  toYMD,
  type DateRangeFilterValue,
  type DateRangePreset,
} from '@/lib/date-range';

interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
}

const PRESETS: Array<{ key: DateRangePreset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

function isActivePreset(
  key: DateRangePreset,
  current: DateRangeFilterValue,
): boolean {
  // The "Custom" button is active whenever a custom range is in use.
  if (key === 'custom') return current.preset === 'custom';
  return current.preset === key;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const handlePreset = (key: DateRangePreset) => {
    if (key === 'custom') {
      // Dropping into custom keeps the current dates so the user can tweak them.
      onChange({ preset: 'custom', from: value.from, to: value.to });
      return;
    }
    const range = computePresetRange(key);
    onChange({ preset: key, ...range });
  };

  const handleCustomDate = (field: 'from' | 'to', raw: string) => {
    const next = { ...value, preset: 'custom' as DateRangePreset, [field]: raw };
    // Normalise to yyyy-mm-dd (empty when the user clears the field).
    if (!raw) {
      next[field] = '';
    } else {
      const d = new Date(`${raw}T00:00:00`);
      next[field] = Number.isNaN(d.getTime()) ? '' : toYMD(d);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset segment */}
      <div className="flex items-center rounded-lg border border-mist bg-white p-0.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => handlePreset(preset.key)}
            className={`rounded-md px-3 py-1 font-body text-xs transition-colors ${
              isActivePreset(preset.key, value)
                ? 'bg-espresso text-pearl'
                : 'text-espresso hover:bg-linen'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from}
            onChange={(e) => handleCustomDate('from', e.target.value)}
            className="rounded-lg border border-mist bg-white px-3 py-1.5 font-body text-sm text-espresso"
          />
          <span className="font-body text-xs text-mist">to</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => handleCustomDate('to', e.target.value)}
            className="rounded-lg border border-mist bg-white px-3 py-1.5 font-body text-sm text-espresso"
          />
        </div>
      )}
    </div>
  );
}
