'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ColourChipInputProps {
  value: string[];
  onChange: (colours: string[]) => void;
}

export function ColourChipInput({ value, onChange }: ColourChipInputProps) {
  const [input, setInput] = useState('');

  const addColour = (raw: string) => {
    const colour = raw.trim();
    if (!colour) return;
    if (value.some((c) => c.toLowerCase() === colour.toLowerCase())) return;
    onChange([...value, colour]);
    setInput('');
  };

  const removeColour = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addColour(input);
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeColour(value.length - 1);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((colour, i) => (
          <span
            key={`${colour}-${i}`}
            className="inline-flex items-center gap-1 bg-espresso text-pearl rounded-full px-3 py-1 text-xs font-semibold"
          >
            <span
              className="inline-block h-3 w-3 rounded-full border border-pearl/30 shrink-0"
              style={{ backgroundColor: colour }}
              aria-hidden="true"
            />
            {colour}
            <button
              type="button"
              onClick={() => removeColour(i)}
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
        placeholder="Type a colour and press Enter"
        className="font-body"
      />
    </div>
  );
}
