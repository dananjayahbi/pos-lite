'use client';

import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

// ── Preset size groups ───────────────────────────────────────────────────────

const SIZE_GROUPS = [
  { label: 'Tops / Bottoms', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Kids', values: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y'] },
  { label: 'Numeric', values: ['28', '30', '32', '34', '36', '38', '40'] },
  { label: 'Shoes (EU)', values: ['36', '37', '38', '39', '40', '41', '42', '43', '44'] },
  { label: 'One Size', values: ['OS'] },
] as const;

interface SizePickerPanelProps {
  value: string;
  onChange: (size: string) => void;
}

export function SizePickerPanel({ value, onChange }: SizePickerPanelProps) {
  const [customInput, setCustomInput] = useState('');

  const handleSelect = (size: string) => {
    onChange(size === value ? '' : size);
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
      {SIZE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-mist">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.values.map((size) => {
              const isSelected = value === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleSelect(size)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'border-espresso bg-espresso text-pearl'
                      : 'border-sand/60 bg-pearl text-espresso hover:border-espresso/60 hover:bg-sand/20'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom size */}
      <div>
        <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-mist">
          Custom Size
        </p>
        <div className="flex gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            onBlur={handleCustomBlur}
            placeholder="Type &amp; press Enter"
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
