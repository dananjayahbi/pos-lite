'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PACK_SIZE_PRESETS } from '@/lib/constants/product-options';

/**
 * Pack-size chip input — replaces the clothing size-chip input.
 *
 * Pack sizes in ayurveda products are free-text (`100g`, `200ml`, `60 caps`,
 * `30 sachets`, etc.) so this is a tag-style input with preset chips.
 */

interface PackSizeChipInputProps {
  value: string[];
  onChange: (sizes: string[]) => void;
}

const PRESETS = [
  {
    label: 'Powder 50–500g',
    values: ['50g', '100g', '250g', '500g'],
  },
  {
    label: 'Capsules 30–100',
    values: ['30 caps', '60 caps', '100 caps'],
  },
  {
    label: 'Oils 50–500ml',
    values: ['50ml', '100ml', '200ml', '500ml'],
  },
  {
    label: 'Syrups 100–500ml',
    values: ['100ml', '200ml', '500ml'],
  },
] as const;

export function PackSizeChipInput({ value, onChange }: PackSizeChipInputProps) {
  const [input, setInput] = useState('');

  const addSize = (raw: string) => {
    const size = raw.trim();
    if (!size) return;
    if (value.some((s) => s.toLowerCase() === size.toLowerCase())) return;
    onChange([...value, size]);
    setInput('');
  };

  const removeSize = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSize(input);
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeSize(value.length - 1);
    }
  };

  const applyPreset = (preset: readonly string[]) => {
    onChange([...preset]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset.values)}
            className="border border-sand text-espresso hover:bg-sand/20 rounded-full px-3 py-1 text-xs font-body transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((size, i) => (
          <span
            key={`${size}-${i}`}
            className="inline-flex items-center gap-1 bg-espresso text-pearl rounded-full px-3 py-1 text-xs font-semibold"
          >
            {size}
            <button
              type="button"
              onClick={() => removeSize(i)}
              className="hover:text-sand transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a pack size (e.g. 75g, 200ml) and press Enter"
        className="font-body"
      />
      <p className="mt-1 text-xs text-mist">
        Common presets: {PACK_SIZE_PRESETS.slice(0, 6).join(', ')}, …
      </p>
    </div>
  );
}