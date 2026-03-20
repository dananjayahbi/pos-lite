'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SIZE_PRESETS = [
  { label: 'S / M / L / XL', values: ['S', 'M', 'L', 'XL'] },
  { label: 'XS – XXL', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: '2Y / 4Y / 6Y / 8Y / 10Y', values: ['2Y', '4Y', '6Y', '8Y', '10Y'] },
  { label: 'One Size', values: ['OS'] },
] as const;

interface SizeChipInputProps {
  value: string[];
  onChange: (sizes: string[]) => void;
}

export function SizeChipInput({ value, onChange }: SizeChipInputProps) {
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
        {SIZE_PRESETS.map((preset) => (
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
        placeholder="Type a size and press Enter"
        className="font-body"
      />
    </div>
  );
}
