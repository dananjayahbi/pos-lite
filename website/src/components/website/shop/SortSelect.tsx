'use client';

import React from 'react';
import { Dropdown } from './Dropdown';

interface SortSelectProps {
  value?: string | undefined;
  onChange: (value: string) => void;
}

const SORT_OPTIONS = [
  { value: 'latest', label: 'Featured' },
  { value: 'best-selling', label: 'Best Selling' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/**
 * Sort control for the shop filter panel. Uses the custom-styled `Dropdown`
 * instead of the native `<select>` to match the reference dark theme.
 */
export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Dropdown
      options={SORT_OPTIONS}
      value={value || 'latest'}
      onChange={onChange}
      ariaLabel="Sort products"
      prefix="Sort:"
    />
  );
}

