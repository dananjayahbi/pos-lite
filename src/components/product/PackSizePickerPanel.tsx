'use client';

import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

// ── Preset pack-size groups (ayurveda) ───────────────────────────────────────

const PACK_SIZE_GROUPS = [
  { label: 'Powders', values: ['25g', '50g', '100g', '250g', '500g', '1kg'] },
  { label: 'Capsules / Tablets', values: ['30 caps', '60 caps', '100 caps'] },
  {
    label: 'Oils / Liquids',
    values: ['50ml', '100ml', '200ml', '500ml', '1L'],
  },
  { label: 'Sachets', values: ['10 sachets', '20 sachets', '30 sachets'] },
] as const;

interface PackSizePickerPanelProps {
  value: string;
  onChange: (packSize: string) => void;
}

export function PackSizePickerPanel({
  value,
  onChange,
}: PackSizePickerPanelProps) {
  const [customInput, setCustomInput] = useState('');

  const handleSelect = (packSize: string) => {
    onChange(packSize === value ? '' : packSize);
  };

  const handleCustomKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = customInput.trim();
      if (trimmed) {
        onChange(trimmed);
        setCustomInput('');
      }
    }
  };

  const handleCustomBlur = () => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setCustomInput('');
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-sand/30 bg-linen/40 p-3">
      {/* Preset groups */}
      {PACK_SIZE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-mist">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.values.map((packSize) => {
              const isSelected = value === packSize;
              return (
                <button
                  key={packSize}
                  type="button"
                  onClick={() => handleSelect(packSize)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'border-espresso bg-espresso text-pearl'
                      : 'border-sand/60 bg-pearl text-espresso hover:border-espresso/60 hover:bg-sand/20'
                  }`}
                >
                  {packSize}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom pack size */}
      <div>
        <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-mist">
          Custom Pack Size
        </p>
        <div className="flex gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            onBlur={handleCustomBlur}
            placeholder="e.g. 75g — type & press Enter"
            className="font-body text-sm h-8"
          />
          {value && (
            <span className="inline-flex items-center rounded-full bg-espresso/10 px-2.5 py-0.5 text-xs font-semibold text-espresso border border-espresso/20">
              {value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}