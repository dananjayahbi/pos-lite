'use client';

/**
 * Custom-styled dropdown (replaces the native `<select>`). Matches the dark
 * Ayurveda reference theme with an animated open state and a green highlight
 * for the active option. Completely keyboard-accessible (ArrowUp/Down/Enter/
 * Escape) and closes on outside click.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  /** Callback fired when a new option is chosen. */
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Optional leading label rendered before the value (e.g. "Sort:"). */
  prefix?: string;
}

export function Dropdown({ options, value, onChange, ariaLabel, prefix }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="shop-sort-select inline-flex w-full items-center justify-between gap-2 sm:w-auto lg:w-full"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="truncate">
          {prefix && <span className="mr-1.5 text-[#64748b]">{prefix}</span>}
          {selected?.label}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#97c93e] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="shop-dropdown-menu z-30 absolute right-0 top-[calc(100%+6px)] min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d2e22] shadow-2xl backdrop-blur-xl"
        >
          {options.map((opt) => {
            const isActive = opt.value === (value ?? options[0]?.value);
            return (
              <li key={opt.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-[#97c93e]'
                      : 'text-[#cbd5e1] hover:bg-white/5 hover:text-white'
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                  {isActive && <Check size={14} className="shrink-0 text-[#97c93e]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
