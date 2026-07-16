'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CustomerResult {
  id: string;
  name: string;
  phone: string;
  creditBalance: string;
}

interface CustomerSearchDropdownProps {
  onSelect: (customer: { id: string; name: string; creditBalance: string }) => void;
  onClear: () => void;
}

export function CustomerSearchDropdown({ onSelect, onClear }: CustomerSearchDropdownProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data } = useQuery<{ success: boolean; data: { customers: CustomerResult[] } }>({
    queryKey: ['customer-search', debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/store/customers?search=${encodeURIComponent(debouncedSearch)}&limit=5`);
      if (!res.ok) throw new Error('Failed to search customers');
      return res.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  const customers = data?.data?.customers ?? [];

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mist" />
        <Input
          ref={inputRef}
          placeholder="Link customer..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (debouncedSearch.length >= 2) setOpen(true);
          }}
          className="pl-8 h-8 text-sm"
        />
      </div>
      {open && customers.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-pearl border border-mist rounded-lg shadow-lg overflow-hidden">
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-linen transition-colors"
              onClick={() => {
                onSelect({ id: c.id, name: c.name, creditBalance: String(c.creditBalance) });
                setSearch('');
                setOpen(false);
              }}
            >
              <p className="font-body text-sm text-espresso font-medium">{c.name}</p>
              <p className="font-mono text-xs text-mist">{c.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
