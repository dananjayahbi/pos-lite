'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BroadcastFilters {
  tags: string;
  gender: string;
  minSpend: string;
  maxSpend: string;
  birthdayMonth: string;
}

interface BroadcastFilterPanelProps {
  filters: BroadcastFilters;
  onChange: (filters: BroadcastFilters) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function BroadcastFilterPanel({ filters, onChange }: BroadcastFilterPanelProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const debouncedOnChange = useCallback(
    (updated: BroadcastFilters) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onChange(updated);
      }, 300);
    },
    [onChange],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleInputChange = (field: keyof BroadcastFilters, value: string) => {
    const updated = { ...filters, [field]: value };
    debouncedOnChange(updated);
  };

  const handleSelectChange = (field: keyof BroadcastFilters, value: string) => {
    const updated = { ...filters, [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-espresso uppercase tracking-wide">
        Audience Filters
      </h3>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="filter-tags" className="text-sm text-espresso">
          Tags <span className="text-sand text-xs">(comma-separated)</span>
        </Label>
        <Input
          id="filter-tags"
          placeholder="VIP, WHOLESALE, REGULAR"
          defaultValue={filters.tags}
          onChange={(e) => handleInputChange('tags', e.target.value)}
          className="border-mist"
        />
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <Label className="text-sm text-espresso">Gender</Label>
        <Select
          value={filters.gender}
          onValueChange={(v) => handleSelectChange('gender', v)}
        >
          <SelectTrigger className="border-mist">
            <SelectValue placeholder="All genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Spend Band */}
      <div className="space-y-1.5">
        <Label className="text-sm text-espresso">Spend Range (Rs.)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            defaultValue={filters.minSpend}
            onChange={(e) => handleInputChange('minSpend', e.target.value)}
            className="border-mist"
          />
          <span className="text-sand text-sm">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            defaultValue={filters.maxSpend}
            onChange={(e) => handleInputChange('maxSpend', e.target.value)}
            className="border-mist"
          />
        </div>
      </div>

      {/* Birthday Month */}
      <div className="space-y-1.5">
        <Label className="text-sm text-espresso">Birthday Month</Label>
        <Select
          value={filters.birthdayMonth}
          onValueChange={(v) => handleSelectChange('birthdayMonth', v)}
        >
          <SelectTrigger className="border-mist">
            <SelectValue placeholder="Any month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Month</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
